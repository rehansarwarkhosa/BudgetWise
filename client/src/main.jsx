import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize OneSignal for push notifications
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.init({
    appId: '96cfa184-fc68-404e-a6ab-4b92fb13e6b1',
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    allowLocalhostAsSecureOrigin: true,
  });
  // Auto-prompt for push notification permission if not already granted
  try {
    const permission = OneSignal.Notifications.permission;
    if (!permission) {
      OneSignal.Slidedown.promptPush();
    }
  } catch (e) {
    console.warn('OneSignal prompt error:', e);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
