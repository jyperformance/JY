import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export const pushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

// Push requires a real backend to send from (a browser can subscribe, but
// can't send push to itself or other devices — see README "Push
// Notifications"). Until VAPID keys are configured, treat push as
// unavailable rather than half-working.
export const pushConfigured = pushSupported && !!VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function getNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

/**
 * Ask the browser for notification permission, subscribe to push, and save
 * the subscription against `ownerId` ("coach" or a client key) so the
 * send-push Edge Function knows where to deliver new-message pushes.
 * Returns true on success.
 */
export async function enablePushNotifications(ownerId) {
  if (!pushConfigured) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  if (supabase) {
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { owner_id: ownerId, endpoint: subscription.endpoint, subscription: subscription.toJSON() },
        { onConflict: "endpoint" }
      );
    if (error) {
      console.error("Supabase save push subscription error:", error);
      return false;
    }
  }
  // No Supabase configured — subscription exists in the browser but nothing
  // can trigger a send. Treat this device as "not really enabled."
  return !!supabase;
}

/**
 * Whether this device already has an active push subscription.
 */
export async function isPushEnabled() {
  if (!pushSupported) return false;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

export async function disablePushNotifications() {
  if (!pushSupported) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    if (supabase) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    }
    await subscription.unsubscribe();
  }
}
