import { Router, Request, Response } from 'express';
import { supabaseAuth } from '../config/supabase';

const router = Router();

// 이메일+비밀번호 회원가입
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    user: {
      id: data.user?.id,
      email: data.user?.email,
    },
  });
});

// 이메일+비밀번호 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    user: {
      id: data.user?.id,
      email: data.user?.email,
    },
  });
});

// Google OAuth 토큰으로 Supabase 세션 생성
router.post('/google', async (req: Request, res: Response) => {
  const { id_token } = req.body;

  if (!id_token) {
    res.status(400).json({ error: 'id_token is required' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.signInWithIdToken({
    provider: 'google',
    token: id_token,
  });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    user: {
      id: data.user?.id,
      email: data.user?.email,
    },
  });
});

// 토큰 갱신
router.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token is required' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
  });
});

export default router;
