declare global { interface Window { OneSignalDeferred?: any[] } }

export async function initOneSignal(appId: string) {
  if (typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const s = document.createElement('script');
  s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  s.async = true;
  document.head.appendChild(s);

  await new Promise<void>((resolve) => {
    window.OneSignalDeferred!.push(async (OneSignal: any) => {
      await OneSignal.init({
        appId,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        notifyButton: { enable: false }
      });
      resolve();
    });
  });
}

export async function ensureSubscribed() {
  // @ts-ignore
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return false;
  const enabled = await OneSignal.isPushNotificationsEnabled();
  if (enabled) return true;
  await OneSignal.Slidedown.promptPush();
  return await OneSignal.isPushNotificationsEnabled();
}

export async function tagUserAndSession(userId: string, sessionId: string) {
  // @ts-ignore
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;
  await OneSignal.User.addAlias("external_id", userId); // critical for targeting
  await OneSignal.User.addTag("user_id", userId);
  await OneSignal.User.addTag("session_id", sessionId);
}

export async function oneSignalDebug() {
  // @ts-ignore
  const OneSignal = (window as any).OneSignal;
  const id = await OneSignal?.User.getId();
  const subId = await OneSignal?.User?.PushSubscription?.id;
  const enabled = await OneSignal?.isPushNotificationsEnabled?.();
  console.log('[OneSignal] enabled=', enabled, ' userId=', id, ' subId=', subId);
}
