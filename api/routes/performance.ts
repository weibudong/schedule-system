import express from 'express';
import { getDb } from '../db/index.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { startDate, endDate, filterType = 'orderDate', userId = '1', type } = req.query;
  const db = getDb();
  
  const dateFieldMap: Record<string, string> = {
    orderDate: 'date',
    invoiceDate: 'invoiceDate',
    paymentDate: 'paymentDate',
  };
  
  const dateField = dateFieldMap[filterType as string] || 'date';
  
  let query = `SELECT id, teacherId as userId, teacher, date, timePeriod, invoiceDate, paymentDate, amount, company, type, customerName, paymentStatus, invoiceStatus, province, city FROM appointments`;
  const params: any[] = [];
  
  if (userId !== 'all') {
    query += ` WHERE teacherId = ?`;
    params.push(userId);
  }
  
  if (startDate && endDate) {
    query += (userId !== 'all' ? ' AND' : ' WHERE') + ` ${dateField} >= ? AND ${dateField} <= ?`;
    params.push(startDate, endDate);
  }
  
  if (type && type !== '全部') {
    const hasWhere = query.includes('WHERE');
    query += (hasWhere ? ' AND' : ' WHERE') + ` type = ?`;
    params.push(type);
  }
  
  query += ` ORDER BY ${dateField} DESC`;
  
  const filteredItems = db.prepare(query).all(...params);
  
  let amountQuery = 'SELECT SUM(amount) as total FROM appointments';
  const amountParams: any[] = [];
  
  if (userId !== 'all') {
    amountQuery += ' WHERE teacherId = ?';
    amountParams.push(userId);
  }
  
  if (startDate && endDate) {
    amountQuery += (userId !== 'all' ? ' AND' : ' WHERE') + ` ${dateField} >= ? AND ${dateField} <= ?`;
    amountParams.push(startDate, endDate);
  }
  
  if (type && type !== '全部') {
    const hasWhere = amountQuery.includes('WHERE');
    amountQuery += (hasWhere ? ' AND' : ' WHERE') + ' type = ?';
    amountParams.push(type);
  }
  
  const totalResult = db.prepare(amountQuery).get(...amountParams) as { total: number | null };
  const totalBonus = totalResult.total || 0;
  
  let statusQuery = 'SELECT paymentStatus, invoiceStatus, COUNT(*) as count FROM appointments';
  const statusParams: any[] = [];
  
  if (userId !== 'all') {
    statusQuery += ' WHERE teacherId = ?';
    statusParams.push(userId);
  }
  
  if (startDate && endDate) {
    statusQuery += (userId !== 'all' ? ' AND' : ' WHERE') + ` ${dateField} >= ? AND ${dateField} <= ?`;
    statusParams.push(startDate, endDate);
  }
  
  if (type && type !== '全部') {
    const hasWhere = statusQuery.includes('WHERE');
    statusQuery += (hasWhere ? ' AND' : ' WHERE') + ' type = ?';
    statusParams.push(type);
  }
  
  statusQuery += ' GROUP BY paymentStatus, invoiceStatus';
  
  const statusResults = db.prepare(statusQuery).all(...statusParams) as { paymentStatus: string; invoiceStatus: string; count: number }[];
  
  const stats = {
    paidCount: 0,
    unpaidCount: 0,
    invoicedCount: 0,
    uninvoicedCount: 0,
  };
  
  statusResults.forEach((row) => {
    if (row.paymentStatus === '已回款') {
      stats.paidCount += row.count;
    } else {
      stats.unpaidCount += row.count;
    }
    if (row.invoiceStatus === '已开票') {
      stats.invoicedCount += row.count;
    } else {
      stats.uninvoicedCount += row.count;
    }
  });
  
  res.json({ totalBonus, performanceList: filteredItems, stats });
});

export default router;
