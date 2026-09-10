import type { Settings } from "../core/model";
import { ringtones, type Ringtone } from "../core/ringtones";
let audio: AudioContext | undefined;
let playing: OscillatorNode[] = [];
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {}
}
function playRingtone(id: Ringtone) {
  if (!audio || audio.state !== "running") return;
  for (const oscillator of playing) {
    try {
      oscillator.stop();
    } catch {}
  }
  playing = [];
  const chosen = ringtones.find((r) => r.id === id) ?? ringtones[0];
  const context = audio;
  chosen.notes.forEach((frequency, index) => {
    const start = context.currentTime + index * chosen.step;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + chosen.length);
    const tone = context.createOscillator();
    tone.type = chosen.wave;
    tone.frequency.setValueAtTime(frequency, start);
    tone.connect(gain);
    tone.onended = () => {
      tone.disconnect();
      gain.disconnect();
      playing = playing.filter((x) => x !== tone);
    };
    playing.push(tone);
    tone.start(start);
    tone.stop(start + chosen.length);
  });
}
export async function previewRingtone(id: Ringtone) {
  audio ??= new AudioContext();
  await audio.resume();
  if (audio.state !== "running")
    throw new Error(
      "Sound could not start. Check your browser audio permissions.",
    );
  playRingtone(id);
}
export function alertUser(settings: Settings, title: string, body: string) {
  if (settings.sound) playRingtone(settings.ringtone);
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
