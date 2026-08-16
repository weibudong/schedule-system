import express from 'express';
import { getDb } from '../db/index.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  const db = getDb();
  
  const user = db.prepare('SELECT * FROM users WHERE phone = ? AND password = ?').get(phone, password);
  
  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } else {
    res.json({
      success: false,
      message: '手机号或密码错误',
    });
  }
});

router.get('/list', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, phone, role FROM users').all();
  res.json({ success: true, users });
});

router.post('/', (req, res) => {
  const { name, phone, password } = req.body;
  
  if (!name || !phone || !password) {
    res.json({ success: false, message: '姓名、手机号和密码为必填项' });
    return;
  }
  
  const db = getDb();
  const existingUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existingUser) {
    res.json({ success: false, message: '该手机号已注册' });
    return;
  }
  
  const maxIdResult = db.prepare('SELECT MAX(id) as maxId FROM users').get();
  const maxId = parseInt((maxIdResult as any)?.maxId || '0') || 0;
  const newId = (maxId + 1).toString();
  
  db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run(
    newId,
    name,
    phone,
    password,
    'sales'
  );
  
  const newUser = db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(newId);
  
  res.json({ success: true, user: newUser });
});

export default router;