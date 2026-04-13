-- ========== 차단 ==========
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own blocks"
  ON blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can read own blocks"
  ON blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks"
  ON blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ========== 신고 ==========
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'fake_profile', 'harassment', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reporter_id, reported_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ========== 매칭 선호도 ==========
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  min_age INTEGER DEFAULT 18 CHECK (min_age >= 18),
  max_age INTEGER DEFAULT 100 CHECK (max_age <= 100),
  preferred_genders TEXT[] DEFAULT '{male,female,other}',
  preferred_languages TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

-- ========== 메시지 읽음 상태 ==========
ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;

-- ========== 매치 언매치 ==========
ALTER TABLE matches ADD COLUMN unmatched_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE matches ADD COLUMN unmatched_by UUID REFERENCES profiles(id);

-- ========== bio 오디오 URL ==========
ALTER TABLE profiles ADD COLUMN bio_audio_url TEXT DEFAULT NULL;

-- ========== 추가 인덱스 ==========
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_read ON messages(match_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = true;

-- ========== 매치 요약 RPC (N+1 해결용) ==========
CREATE OR REPLACE FUNCTION get_match_summaries(match_ids UUID[], viewer_id UUID)
RETURNS TABLE (
  match_id UUID,
  last_message_id UUID,
  last_message_text TEXT,
  last_message_sender_id UUID,
  last_message_created_at TIMESTAMPTZ,
  unread_count BIGINT
) AS $$
  SELECT
    m.match_id,
    msg.id AS last_message_id,
    msg.original_text AS last_message_text,
    msg.sender_id AS last_message_sender_id,
    msg.created_at AS last_message_created_at,
    (SELECT COUNT(*) FROM messages
     WHERE messages.match_id = m.match_id
       AND messages.sender_id != viewer_id
       AND messages.read_at IS NULL
    ) AS unread_count
  FROM unnest(match_ids) AS m(match_id)
  LEFT JOIN LATERAL (
    SELECT id, original_text, sender_id, created_at
    FROM messages
    WHERE messages.match_id = m.match_id
    ORDER BY created_at DESC
    LIMIT 1
  ) msg ON true;
$$ LANGUAGE sql STABLE;
