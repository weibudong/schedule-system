/**
 * This is a API server
 */

import dotenv from 'dotenv'
// load env BEFORE any other imports
dotenv.config()

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import calendarRoutes from './routes/calendar.js'
import performanceRoutes from './routes/performance.js'
import userRoutes from './routes/users.js'
import { sendBackup, restoreFromBackup, backupDataDir } from './services/backup.js'
import { initDb } from './db/index.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: express.Application = express()

initDb()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/performance', performanceRoutes)
app.use('/api/users', userRoutes)

/**
 * 手动触发数据库备份
 */
app.post('/api/backup', async (req: Request, res: Response) => {
  try {
    const result = await sendBackup();
    res.json({ 
      success: result.success, 
      message: result.success ? '备份完成' : '备份部分失败',
      details: {
        emailSent: result.emailSent,
        jsonExported: result.jsonExported,
        dbCopied: result.dbCopied,
        backupTime: result.backupTime,
        errors: result.errors
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 查询备份状态
 */
app.get('/api/backup/status', (req: Request, res: Response) => {
  try {
    // 获取可用的备份文件列表
    const backupFiles: string[] = [];
    if (fs.existsSync(backupDataDir)) {
      const files = fs.readdirSync(backupDataDir).filter(f => f.startsWith('data-') && f.endsWith('.json'));
      backupFiles.push(...files.sort().reverse().slice(0, 10));
    }
    
    // 获取 .db 备份文件列表
    const dbBackupFiles: string[] = [];
    const backupDir = path.join(__dirname, '..', 'backup');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('dev-backup-') && f.endsWith('.db'));
      dbBackupFiles.push(...files.sort().reverse().slice(0, 10));
    }
    
    res.json({
      backupFiles,
      dbBackupFiles,
      mailConfigured: !!process.env.MAIL_PASS
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 从备份恢复数据
 */
app.post('/api/backup/restore', async (req: Request, res: Response) => {
  try {
    const { dateStr } = req.body as { dateStr: string };
    if (!dateStr) {
      res.status(400).json({ success: false, error: '请提供备份日期' });
      return;
    }
    
    const result = await restoreFromBackup(dateStr);
    if (result.success) {
      res.json({ success: true, message: '数据恢复成功' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * 生产环境：托管前端静态文件 (Vite 构建产物 dist/)
 * 需要先执行 `npm run build` 生成 dist 目录
 */
const clientDist = path.resolve(__dirname, '../dist')
app.use(express.static(clientDist))

/**
 * SPA 回退：非 /api 路由统一返回 index.html，交给前端路由处理
 */
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ success: false, error: 'API not found' })
    return
  }
  res.sendFile(path.join(clientDist, 'index.html'))
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error.message, error.stack)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    message: error.message,
  })
})

export default app
