import express from 'express';
import { getDb } from '../db/index.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { month, userId = '1' } = req.query;
  const db = getDb();
  
  let query = 'SELECT * FROM appointments';
  const params: any[] = [];
  
  if (userId !== 'all') {
    query += ' WHERE teacherId = ?';
    params.push(userId);
  }
  
  if (month) {
    query += (userId !== 'all' ? ' AND' : ' WHERE') + ' date LIKE ?';
    params.push(`${month}%`);
  }
  
  const filteredAppointments = db.prepare(query).all(...params);
  
  const user = userId !== 'all' ? db.prepare('SELECT name FROM users WHERE id = ?').get(userId) : null;
  
  let summaryQuery = '';
  const summaryParams: any[] = [];
  
  if (userId !== 'all') {
    summaryQuery += 'WHERE teacherId = ?';
    summaryParams.push(userId);
  }
  
  if (month) {
    summaryQuery += (userId !== 'all' ? ' AND' : 'WHERE') + ' date LIKE ?';
    summaryParams.push(`${month}%`);
  }
  
  const totalAmount = (db.prepare(`SELECT SUM(amount) as total FROM appointments ${summaryQuery}`).get(...summaryParams) as any).total || 0;
  const interviewCount = (db.prepare(`SELECT COUNT(*) as count FROM appointments ${summaryQuery} AND type = ?`).get(...[...summaryParams, '面谈']) as any).count || 0;
  const trainingCount = (db.prepare(`SELECT COUNT(*) as count FROM appointments ${summaryQuery} AND type = ?`).get(...[...summaryParams, '培训']) as any).count || 0;
  const meetingCount = (db.prepare(`SELECT COUNT(*) as count FROM appointments ${summaryQuery} AND type = ?`).get(...[...summaryParams, '会议']) as any).count || 0;
  const onlineCount = (db.prepare(`SELECT COUNT(*) as count FROM appointments ${summaryQuery} AND type = ?`).get(...[...summaryParams, '网络']) as any).count || 0;
  const totalCount = (db.prepare(`SELECT COUNT(*) as count FROM appointments ${summaryQuery}`).get(...summaryParams) as any).count || 0;
  
  const summary = {
    totalAmount,
    interviewCount,
    trainingCount,
    meetingCount,
    onlineCount,
    totalCount,
    userName: (user as any)?.name || '所有人',
  };

  res.json({ appointments: filteredAppointments, summary });
});

router.post('/', (req, res) => {
  const { date, timePeriod, company, type, amount, remark, status, customerName, paymentStatus, userId = '1', teacherId } = req.body;
  const db = getDb();

  // 冲突检查：同一执行人员同一日期同一时间段只能有一个行程
  if (teacherId && date && timePeriod) {
    const conflict = db.prepare('SELECT id, customerName, teacher FROM appointments WHERE teacherId = ? AND date = ? AND timePeriod = ?').get(teacherId, date, timePeriod) as any;
    if (conflict) {
      res.json({ success: false, message: `该执行人员在此时间段已有行程（${conflict.customerName || conflict.teacher}），不能重复添加` });
      return;
    }
  }

  const teacherUser = db.prepare('SELECT name FROM users WHERE id = ?').get(teacherId);
  const teacherName = teacherUser?.name || '';

  const id = Date.now().toString();
  
  db.prepare(`
    INSERT INTO appointments (id, userId, date, timePeriod, company, type, teacher, teacherId, amount, remark, status, customerName, paymentStatus, invoiceStatus, province, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    date,
    timePeriod || '上午',
    company,
    type,
    teacherName,
    teacherId || '',
    Number(amount) || 0,
    remark || '',
    status || '待审核',
    customerName || company,
    paymentStatus || '未回款',
    (req.body as any).invoiceStatus || '未开票',
    (req.body as any).province || '',
    (req.body as any).city || ''
  );
  
  const newAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  
  res.json({ success: true, appointment: newAppointment });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { date, timePeriod, company, type, amount, remark, status, customerName, paymentStatus, teacherId, invoiceStatus, invoiceDate, paymentDate, invoiceNo } = req.body;
  const db = getDb();
  
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

  // 冲突检查：同一执行人员同一日期同一时间段只能有一个行程（排除自身）
  const checkTeacherId = teacherId || (existing as any)?.teacherId;
  const checkDate = date || (existing as any)?.date;
  const checkTimePeriod = timePeriod || (existing as any)?.timePeriod;
  if (checkTeacherId && checkDate && checkTimePeriod) {
    const conflict = db.prepare('SELECT id, customerName, teacher FROM appointments WHERE teacherId = ? AND date = ? AND timePeriod = ? AND id != ?').get(checkTeacherId, checkDate, checkTimePeriod, id) as any;
    if (conflict) {
      res.json({ success: false, message: `该执行人员在此时间段已有行程（${conflict.customerName || conflict.teacher}），不能重复添加` });
      return;
    }
  }

  const teacherUser = teacherId ? db.prepare('SELECT name FROM users WHERE id = ?').get(teacherId) : null;
  const teacherName = teacherUser?.name || null;
  
  const now = new Date().toISOString().split('T')[0];
  const finalInvoiceDate = (invoiceDate !== undefined && invoiceDate !== '') ? invoiceDate : (invoiceStatus === '已开票' ? now : '');
  const finalPaymentDate = (paymentDate !== undefined && paymentDate !== '') ? paymentDate : (paymentStatus === '已回款' ? now : '');
  
  if (existing) {
    db.prepare(`
      UPDATE appointments 
      SET date = COALESCE(?, date),
          timePeriod = COALESCE(?, timePeriod),
          company = COALESCE(?, company),
          type = COALESCE(?, type),
          teacher = COALESCE(?, teacher),
          teacherId = COALESCE(?, teacherId),
          amount = COALESCE(?, amount),
          remark = COALESCE(?, remark),
          status = COALESCE(?, status),
          customerName = COALESCE(?, customerName),
          paymentStatus = COALESCE(?, paymentStatus),
          invoiceStatus = COALESCE(?, invoiceStatus),
          invoiceNo = COALESCE(?, invoiceNo),
          invoiceDate = COALESCE(?, invoiceDate),
          paymentDate = COALESCE(?, paymentDate),
          province = COALESCE(?, province),
          city = COALESCE(?, city)
      WHERE id = ?
    `).run(
      date || null,
      timePeriod || null,
      company || null,
      type || null,
      teacherName,
      teacherId || null,
      amount !== undefined ? Number(amount) : null,
      remark !== undefined ? remark : null,
      status || null,
      customerName || null,
      paymentStatus || null,
      invoiceStatus || null,
      invoiceNo !== undefined ? invoiceNo : null,
      finalInvoiceDate,
      finalPaymentDate,
      (req.body as any).province || null,
      (req.body as any).city || null,
      id
    );
    
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    res.json({ success: true, appointment: updated });
  } else {
    res.json({ success: false, message: '行程不存在' });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  
  if (existing) {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '行程不存在' });
  }
});

export default router;
