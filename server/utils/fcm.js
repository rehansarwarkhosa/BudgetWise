import { readFileSync, existsSync } from 'fs';
import DeviceToken from '../models/DeviceToken.js';

const APP_ID = 'budgetwise';
const APP_NAME = 'BudgetWise';

let admin = null;
let initPromise = null;
let initError = null;

async function getAdmin() {
  if (admin) return admin;
  if (initError) return null;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = await import('firebase-admin');
        const adminLib = mod.default || mod;

        let serviceAccount = null;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          } catch (e) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message);
          }
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
          const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
          if (!existsSync(p)) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH file not found: ' + p);
          serviceAccount = JSON.parse(readFileSync(p, 'utf8'));
        } else {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH not set');
        }

        if (!adminLib.apps?.length) {
          adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
        }
        admin = adminLib;
        return admin;
      } catch (err) {
        initError = err;
        console.error('[fcm] Firebase admin init failed:', err.message);
        return null;
      }
    })();
  }
  return initPromise;
}

export async function isFcmConfigured() {
  const a = await getAdmin();
  return !!a;
}

export async function sendFcmToAll(title, body, options = {}) {
  const a = await getAdmin();
  if (!a) {
    return { sent: false, reason: initError ? initError.message : 'Firebase admin not initialized' };
  }

  const tokens = await DeviceToken.find({ app_id: options.appId || APP_ID }).select('token').lean();
  if (!tokens.length) {
    return { sent: false, reason: 'No device tokens registered', recipients: 0 };
  }

  const tokenStrings = tokens.map(t => t.token);
  const category = options.category || 'reminder';
  const data = {
    app_id: options.appId || APP_ID,
    app_name: options.appName || APP_NAME,
    notification_id: options.notificationId || `notif-${Date.now()}`,
    category,
    priority: options.priority || 'high',
    timestamp: new Date().toISOString(),
    deep_link: options.deepLink || options.url || '',
    icon_color: options.iconColor || '#6C63FF',
    payload: typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload || {}),
  };

  const message = {
    notification: { title, body },
    data,
    android: {
      priority: 'HIGH',
      notification: {
        channelId: `${data.app_id}_${category}`,
        color: data.icon_color,
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  const batchSize = 500;
  try {
    for (let i = 0; i < tokenStrings.length; i += batchSize) {
      const batch = tokenStrings.slice(i, i + batchSize);
      const resp = await a.messaging().sendEachForMulticast({ tokens: batch, ...message });
      successCount += resp.successCount;
      failureCount += resp.failureCount;
      resp.responses.forEach((r, idx) => {
        if (!r.success && r.error) {
          const code = r.error.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
            invalidTokens.push(batch[idx]);
          }
        }
      });
    }

    if (invalidTokens.length) {
      await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
    }

    return {
      sent: successCount > 0,
      recipients: successCount,
      failed: failureCount,
      pruned: invalidTokens.length,
    };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}
