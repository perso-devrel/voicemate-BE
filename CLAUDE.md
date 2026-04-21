# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 개발 서버 (tsx watch, 핫리로드)
npm run build        # TypeScript 컴파일 (dist/)
npm start            # 프로덕션 서버
npm test             # vitest 전체 테스트
npx vitest run tests/auth.test.ts  # 단일 테스트 파일 실행
```

## Architecture

Express 5 + Supabase + ElevenLabs 기반 크로스언어 소개팅 API 서버.

**인증 흐름**: Google OAuth id_token → Supabase `signInWithIdToken` → JWT 발급. 이후 요청은 `authMiddleware`에서 Supabase JWT secret으로 검증하여 `req.userId`(= `sub` claim) 세팅.

**메시지 파이프라인**: 텍스트 메시지를 즉시 저장/응답한 뒤, 발신자에게 ElevenLabs voice clone이 있으면 비동기로 번역 → TTS → Storage 업로드 처리. 송수신자 언어가 다르면 Gemini 2.0 Flash로 번역(존댓말/초면 컨텍스트 시스템 프롬프트) → `translated_text`에 저장, 이후 ElevenLabs `eleven_multilingual_v2` TTS로 발신자 클론 보이스 합성. 같은 언어면 번역 생략하고 원문 그대로 TTS. `audio_status` 필드로 진행 상태 추적. 차단된 유저 간 메시지 전송은 403 차단.

**Bio 오디오**: 프로필 bio 작성/수정 시 voice clone이 있으면 비동기로 TTS 생성하여 `bio_audio_url`에 저장. 프로필 조회 시 추가 API 호출 없이 URL 반환.

**추천 알고리즘**: 디스커버에서 스와이프/차단/선호도를 병렬 조회 후, 후보를 limit×5개(최대 200) 가져옴. 서버에서 가중 점수(언어 차이 +30, 관심사 겹침 ×10, voice clone +15, 프로필 완성도, 신규 부스트, 결정적 hash jitter) 계산 → 높은 순 정렬 → limit개 반환. `src/routes/swipe.ts`의 `computeScore()` + `hashJitter()`. jitter는 같은 viewer-candidate 쌍에 대해 결정적이므로 페이지네이션 시 순서 안정.

**라우트 마운트 구조**:
- `/api/auth` — Google OAuth, 토큰 갱신
- `/api/profile` — 프로필 CRUD, 사진 업로드/삭제 (JPEG/PNG/WebP만 허용, 파일명 UUID화)
- `/api/voice` — ElevenLabs 음성 클론 관리
- `/api/discover` — 추천 후보 조회, 스와이프 (동시 like 중복 매치 방지)
- `/api/matches` — 매치 목록(N+1 해결 RPC, 커서 페이지네이션), 언매치, 메시지 CRUD, 읽음 처리
- `/api/block` — 유저 차단/해제/목록 (차단 시 매치 자동 soft delete, 해제 시 404 처리)
- `/api/report` — 유저 신고
- `/api/preferences` — 매칭 선호도 (나이/성별/언어 필터)
- `/docs` — Swagger UI

## Key Conventions

- 모든 인증 필요 라우트는 `authMiddleware`를 `router.use()`로 적용
- 입력 검증: zod 스키마 (`src/schemas/`) + `validateBody`/`validateQuery` 미들웨어 (`src/middleware/validate.ts`). Express 5에서 `req.query`는 getter 전용이므로 `Object.defineProperty`로 덮어씀.
- 에러 처리: `AppError` 클래스 (`src/errors.ts`) + `errorMiddleware`에서 `instanceof` 판별
- Supabase service role key 사용 (RLS 우회) — 서버 사이드 전용. `env.supabase.anonKey`도 설정 가능.
- 매치 생성 시 `user1_id < user2_id` 정렬 보장 (DB UNIQUE 제약조건). 동시 like로 인한 중복(23505) 시 기존 매치 조회로 fallback.
- 매치 삭제는 soft delete (`unmatched_at`, `unmatched_by`)
- 파일 업로드: multer 메모리 스토리지 → Supabase Storage `uploadFile` 유틸. 사진 파일명은 `{timestamp}_{uuid}.{ext}`로 원본명 미사용.
- 사진 삭제: DB 먼저 업데이트 후 Storage 삭제는 fire-and-forget (Storage 고아 파일보다 DB 불일치가 더 위험)
- 비동기 처리 (메시지 번역/TTS, bio 오디오): fire-and-forget + `.catch()` 로깅. 상태 필드로 추적.
- 번역은 `src/services/translation.ts`의 `translateMessage()` (Gemini 2.0 Flash, `responseMimeType: application/json`, `BLOCK_ONLY_HIGH` safety). TTS는 `src/services/elevenlabs.ts`의 `synthesizeSpeech()`.
- Supabase `.update()` / `.delete()`에서 count가 필요하면 `{ count: 'exact' }` 옵션 사용

## DB Migrations

- `001_initial_schema.sql` — profiles, swipes, matches, messages + RLS + Realtime
- `002_blocks_reports_preferences_read.sql` — blocks, reports, user_preferences 테이블 + messages.read_at + matches.unmatched_at/unmatched_by + profiles.bio_audio_url + get_match_summaries RPC + 추가 인덱스

## Testing

vitest + supertest. `tests/setup.ts`에서 env, Supabase, ElevenLabs, Storage를 전역 모킹. `app`은 `src/index.ts`에서 export하며, `NODE_ENV=test`일 때 `listen()` 스킵.

`tests/helpers.ts`: `generateTestToken(userId?)`, `createMockSupabaseQuery(data, error)` — 체이닝 가능한 Supabase 쿼리 mock 생성.
