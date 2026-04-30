import { Router } from 'express';
import DeviceToken from '../models/DeviceToken.js';
import AuditLog from '../models/AuditLog.js';
import { success, error } from '../utils/response.js';
import { sendFcmToAll, isFcmConfigured } from '../utils/fcm.js';

const router = Router();

const APP_ID = 'budgetwise';
const APP_NAME = 'BudgetWise';

router.get('/ping', (req, res) => {
  res.json({ status: 'ok', app_id: APP_ID, app_name: APP_NAME });
});

router.post('/register-device-token', async (req, res, next) => {
  try {
    const { token, app_id } = req.body || {};
    if (!token || typeof token !== 'string') return error(res, 'token is required');

    const appId = (app_id && typeof app_id === 'string') ? app_id : APP_ID;

    const existing = await DeviceToken.findOne({ token });
    if (existing) {
      existing.app_id = appId;
      existing.lastUsedAt = new Date();
      await existing.save();
      return res.json({ success: true, registered: false, updated: true });
    }

    await DeviceToken.create({ token, app_id: appId });
    await AuditLog.create({
      action: 'CREATE', entity: 'DeviceToken',
      details: `Registered FCM device token for app_id="${appId}" (${token.slice(0, 12)}…)`,
    });

    res.json({ success: true, registered: true });
  } catch (err) { next(err); }
});

router.post('/unregister-device-token', async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return error(res, 'token is required');
    await DeviceToken.deleteOne({ token });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/device-tokens', async (req, res, next) => {
  try {
    const tokens = await DeviceToken.find().sort({ createdAt: -1 }).lean();
    success(res, tokens.map(t => ({
      _id: t._id,
      app_id: t.app_id,
      tokenPreview: `${t.token.slice(0, 12)}…${t.token.slice(-6)}`,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    })));
  } catch (err) { next(err); }
});

router.post('/test', async (req, res, next) => {
  try {
    const configured = await isFcmConfigured();
    if (!configured) return error(res, 'Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
    const { title, body } = req.body || {};
    const result = await sendFcmToAll(
      title || 'BudgetWise — Test',
      body || 'If you see this, FCM is working!',
      { category: 'info', deepLink: process.env.APP_URL || '' }
    );
    if (!result.sent) return error(res, `FCM send failed: ${result.reason || 'unknown'}`);
    success(res, result);
  } catch (err) { next(err); }
});

export default router;
