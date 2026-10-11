/**
 * services/pwa.js – service-worker registration + Web Push helpers.
 * Registers only in production builds (avoids stale caches during dev).
 */
import { notificationsApi } from "./dataApi";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* PWA is an enhancement; ignore failures */ });
  });
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Asks permission, subscribes this device and registers it with the backend. Signed-in users only. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("Push notifications aren't supported on this browser.");
  const status = await notificationsApi.status();
  if (!status.channels?.webpush || !status.vapidPublicKey) throw new Error("Push notifications aren't set up on this server.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(status.vapidPublicKey) }));
  await notificationsApi.subscribePush(sub.toJSON());
  return true;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await notificationsApi.unsubscribePush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
}
