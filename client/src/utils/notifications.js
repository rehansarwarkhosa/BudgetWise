import { subscribeToPush } from '../api';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  const permission = await Notification.requestPermission();
  return permission;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration;
}

export async function setupPushSubscription() {
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return null;

  const registration = await registerServiceWorker();
  if (!registration) return null;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    // VAPID public key must be set in environment
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return null;

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
  }

  await subscribeToPush(subscription.toJSON());
  return subscription;
}
