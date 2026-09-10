import type { Settings } from "../core/model";
let audio: AudioContext | undefined;
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {}
}
export function alertUser(settings: Settings, title: string, body: string) {
  if (settings.sound && audio?.state === "running") {
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
    const tone = audio.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(660, audio.currentTime);
    tone.frequency.setValueAtTime(880, audio.currentTime + 0.18);
    tone.connect(gain);
    tone.start();
    tone.stop(audio.currentTime + 0.8);
  }
  if (
    settings.notifications &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      const n = new Notification(title, {
        body,
        tag: "pacana-checkpoint",
        icon: "/favicon.svg",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* In-app pending list remains available on platforms requiring push. */
    }
  }
}
export async function enableNotifications() {
  if (!("Notification" in window))
    throw new Error(
      "This browser does not support desktop notifications. In-app reminders remain available.",
    );
  const p = await Notification.requestPermission();
  if (p !== "granted")
    throw new Error(
      "Notifications were not enabled. You can still use sound and in-app reminders.",
    );
}
export function setupOffline() {
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
}
