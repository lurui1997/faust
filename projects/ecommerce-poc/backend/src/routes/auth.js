import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db.js';
import { config } from '../config.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: '请填写用户名、邮箱和密码' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  const existing = await queryOne(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email],
  );
  if (existing) {
    return res.status(409).json({ error: '用户名或邮箱已存在' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, hash],
  );
  const user = { id: result.insertId, username, email, role: 'user' };
  const token = jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
  res.status(201).json({ user, token });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  const row = await queryOne(
    'SELECT id, username, email, password_hash, role FROM users WHERE username = ?',
    [username],
  );
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const user = { id: row.id, username: row.username, email: row.email, role: row.role };
  const token = jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
  res.json({ user, token });
});

router.get('/me', authRequired, async (req, res) => {
  const row = await queryOne(
    'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
    [req.user.id],
  );
  if (!row) return res.status(404).json({ error: '用户不存在' });
  res.json(row);
});

export default router;
