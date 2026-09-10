import type { Settings } from "../core/model";
import { ringtones } from "../core/ringtones";
let audio: AudioContext | undefined;
let playing: AudioScheduledSourceNode[] = [];
let customSource = "";
let customBuffer: AudioBuffer | undefined;
export async function unlockAudio(custom?: string) {
  try {
    audio ??= new AudioContext();
    await audio.resume();
    if (custom) void loadCustom(custom);
  } catch {}
}
async function loadCustom(source: string) {
  if (!audio) return;
  if (customSource === source && customBuffer) return customBuffer;
  const response = await fetch(source);
  customBuffer = await audio.decodeAudioData(await response.arrayBuffer());
  customSource = source;
  return customBuffer;
}
async function playRingtone(settings: Settings) {
  audio ??= new AudioContext();
  if (audio.state !== "running") await audio.resume();
  if (audio.state !== "running") throw new Error("Sound could not start.");
  for (const oscillator of playing) {
    try {
      oscillator.stop();
    } catch {}
  }
  playing = [];
  if (settings.ringtone === "custom") {
    if (!settings.customRingtone)
      throw new Error("Upload a custom ringtone first.");
    const source = audio.createBufferSource();
    const buffer = await loadCustom(settings.customRingtone);
    if (!buffer) throw new Error("Could not prepare the custom ringtone.");
    source.buffer = buffer;
    source.connect(audio.destination);
    source.onended = () => {
      source.disconnect();
      playing = playing.filter((x) => x !== source);
    };
    playing.push(source);
    source.start();
    return;
  }
  const chosen =
    ringtones.find((r) => r.id === settings.ringtone) ?? ringtones[0];
  const context = audio;
  chosen.notes.forEach((frequency, index) => {
    const start = context.currentTime + index * chosen.step;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(chosen.volume, start + 0.015);
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
export async function previewRingtone(settings: Settings) {
  await unlockAudio(settings.customRingtone);
  await playRingtone(settings);
}
export const shouldPlayRingtone = (
  settings: Settings,
  options: { forceSound?: boolean } = {},
) => settings.sound || options.forceSound === true;
export async function alertUser(
  settings: Settings,
  title: string,
  body: string,
  options: { forceSound?: boolean } = {},
) {
  let soundPlayed = false;
  if (shouldPlayRingtone(settings, options)) {
    try {
      await playRingtone(settings);
      soundPlayed = true;
    } catch {
      // The caller shows an in-app fallback instead of failing the timer tick.
    }
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
  return soundPlayed;
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
