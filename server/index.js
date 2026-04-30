import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import errorHandler from './middleware/errorHandler.js';
import settingsRoutes from './routes/settings.js';
import incomeRoutes from './routes/income.js';
import budgetRoutes from './routes/budgets.js';
import budgetTemplateRoutes from './routes/budgetTemplates.js';
import expenseRoutes from './routes/expenses.js';
import routineRoutes from './routes/routines.js';
import savingsRoutes from './routes/savings.js';
import tagRoutes from './routes/tags.js';
import noteRoutes from './routes/notes.js';
import trailRoutes from './routes/trails.js';
import workorderRoutes from './routes/workorders.js';
import priceItemRoutes from './routes/priceItems.js';
import auditLogRoutes from './routes/auditLogs.js';
import stockRoutes from './routes/stock.js';
import reminderRoutes from './routes/reminders.js';
import storeRoutes from './routes/stores.js';
import eventRoutes from './routes/events.js';
import aiRoutes from './routes/ai.js';
import aiResponseRoutes from './routes/aiResponses.js';
import fcmRoutes from './routes/fcm.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/settings', settingsRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/budget-templates', budgetTemplateRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/trails', trailRoutes);
app.use('/api/workorders', workorderRoutes);
app.use('/api/price-items', priceItemRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-responses', aiResponseRoutes);

// FCM (NotifyHub): management at /api/fcm/*, plus the two top-level paths the app expects.
app.use('/api/fcm', fcmRoutes);
app.use('/api/ping', (req, res, next) => { req.url = '/ping'; fcmRoutes(req, res, next); });
app.use('/api/register-device-token', (req, res, next) => { req.url = '/register-device-token'; fcmRoutes(req, res, next); });

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Serve React build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(errorHandler);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
