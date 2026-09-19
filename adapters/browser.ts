import type { Settings } from "../core/model";
import { ringtones } from "../core/ringtones";
let audio: AudioContext | undefined;
let playing: (AudioScheduledSourceNode | HTMLAudioElement)[] = [];
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
  try {
    const response = await fetch(source);
    if (!response.ok && response.status !== 0 && response.status !== 200) {
      throw new Error(`Could not fetch audio file (status: ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    customBuffer = await audio.decodeAudioData(arrayBuffer);
    customSource = source;
    return customBuffer;
  } catch (err) {
    console.warn("[Pacana Audio] WebAudio buffer decode failed:", err);
    throw err;
  }
}
function notifySoundStarted(durationMs?: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pacana:sound-started", { detail: { durationMs } }),
    );
  }
}

function notifySoundEnded() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pacana:sound-ended"));
  }
}

async function playAudioFile(url: string) {
  // 1. Primary: Web Audio API BufferSource
  try {
    const source = audio!.createBufferSource();
    const buffer = await loadCustom(url);
    if (buffer) {
      source.buffer = buffer;
      source.connect(audio!.destination);
      source.onended = () => {
        source.disconnect();
        playing = playing.filter((x) => x !== source);
        notifySoundEnded();
      };
      playing.push(source);
      notifySoundStarted(buffer.duration * 1000);
      source.start();
      return;
    }
  } catch (webAudioErr) {
    console.warn(
      "[Pacana Audio] Web Audio API failed, falling back to HTMLAudioElement:",
      webAudioErr,
    );
  }

  // 2. Secondary Fallback: Standard HTML5 Audio Element
  try {
    const audioEl = new Audio(url);
    audioEl.onended = () => {
      playing = playing.filter((x) => x !== audioEl);
      notifySoundEnded();
    };
    playing.push(audioEl);
    notifySoundStarted();
    await audioEl.play();
    return;
  } catch (fallbackErr) {
    console.error("[Pacana Audio] All playback methods failed:", fallbackErr);
    notifySoundEnded();
    throw new Error(
      "Could not play audio. Please check device volume and audio format.",
    );
  }
}

async function playRingtone(settings: Settings) {
  audio ??= new AudioContext();
  if (audio.state !== "running") await audio.resume();
  if (audio.state !== "running") throw new Error("Audio context could not start.");
  for (const item of playing) {
    try {
      if ("stop" in item) {
        (item as AudioScheduledSourceNode).stop();
      } else if ("pause" in item) {
        (item as HTMLAudioElement).pause();
        (item as HTMLAudioElement).currentTime = 0;
      }
    } catch {}
  }
  playing = [];

  if (settings.ringtone === "custom") {
    if (!settings.customRingtone)
      throw new Error("Upload a custom ringtone first.");
    return await playAudioFile(settings.customRingtone);
  }

  const chosen =
    ringtones.find((r) => r.id === settings.ringtone) ?? ringtones[0];

  if ("file" in chosen && chosen.file) {
    return await playAudioFile(chosen.file);
  }

  if ("notes" in chosen && chosen.notes) {
    const context = audio;
    const totalDuration =
      (chosen.notes.length - 1) * chosen.step + chosen.length;
    notifySoundStarted(totalDuration * 1000);

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
        if (playing.length === 0) {
          notifySoundEnded();
        }
      };
      playing.push(tone);
      tone.start(start);
      tone.stop(start + chosen.length);
    });
  }
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
