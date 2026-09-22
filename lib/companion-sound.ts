/**
 * Gentle Web Audio sound generator for the Capybara Companion.
 * Uses soft harmonic sines and low gain for a cozy, non-intrusive soundscape.
 */
let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playCompanionSound(type: "pet" | "snack" | "pop" | "drop") {
  const ctx = getContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const t = ctx.currentTime;

    if (type === "pet") {
      // Soft gentle two-tone chime (C5 -> E5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.1);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.33);
    } else if (type === "snack") {
      // Gentle nibbles
      [0, 0.1, 0.2].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(380 + idx * 45, t + delay);
        gain.gain.setValueAtTime(0.04, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.07);
      });
    } else if (type === "pop") {
      // Gentle, soft bubble pop for cozy sprout emergence
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (type === "drop") {
      // Soft gentle landing thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch {
    // Fail silently if browser audio policies prevent immediate playback
  }
}

export interface CelebrationAudioHandle {
  pause: () => void;
  stop?: () => void;
}

/**
 * Procedurally synthesizes the ~3.4s breakbeat in memory into an AudioBuffer.
 * Zero network requests, zero file loading latency, 100% reliable across browsers.
 */
function createCelebrationBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const durationSec = 3.4;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const bpm = 132;
  const beatSec = 60 / bpm; // ~0.4545s
  const sixteenthSec = beatSec / 4; // ~0.1136s

  // Kick
  const addKick = (startTime: number, volume = 0.55) => {
    const startSample = Math.floor(startTime * sampleRate);
    const kickDuration = 0.18;
    const kickSamples = Math.floor(kickDuration * sampleRate);
    for (let i = 0; i < kickSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / kickDuration;
      const freq = 45 + 115 * Math.exp(-progress * 18);
      const env = Math.exp(-progress * 9) * volume;
      const sample = Math.sin(2 * Math.PI * freq * t) * env;
      left[startSample + i] += sample * 0.9;
      right[startSample + i] += sample * 0.9;
    }
  };

  // Snare
  const addSnare = (startTime: number, volume = 0.42) => {
    const startSample = Math.floor(startTime * sampleRate);
    const snareDuration = 0.15;
    const snareSamples = Math.floor(snareDuration * sampleRate);
    for (let i = 0; i < snareSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / snareDuration;
      const env = Math.exp(-progress * 14) * volume;
      const tone = Math.sin(2 * Math.PI * 210 * t) * 0.4;
      const noise = (Math.random() * 2 - 1) * 0.6;
      const sample = (tone + noise) * env;
      left[startSample + i] += sample * 0.85;
      right[startSample + i] += sample * 0.85;
    }
  };

  // Hi-hat
  const addHihat = (startTime: number, volume = 0.2) => {
    const startSample = Math.floor(startTime * sampleRate);
    const hatDuration = 0.05;
    const hatSamples = Math.floor(hatDuration * sampleRate);
    for (let i = 0; i < hatSamples && startSample + i < totalSamples; i++) {
      const progress = i / hatSamples;
      const env = Math.exp(-progress * 22) * volume;
      const noise = (Math.random() * 2 - 1) * env;
      left[startSample + i] += noise * 0.7;
      right[startSample + i] += noise * 0.9;
    }
  };

  // Synth Note
  const addSynthNote = (
    startTime: number,
    duration: number,
    freq: number,
    volume = 0.28,
    pan = 0
  ) => {
    const startSample = Math.floor(startTime * sampleRate);
    const noteSamples = Math.floor(duration * sampleRate);
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const env =
        (progress < 0.08 ? progress / 0.08 : Math.exp(-(progress - 0.08) * 3.5)) *
        volume;
      const wave =
        0.6 * Math.sin(2 * Math.PI * freq * t) +
        0.25 * Math.sin(4 * Math.PI * freq * t) +
        0.15 * Math.sin(6 * Math.PI * freq * t);
      const s = wave * env;
      left[startSample + i] += s * leftGain;
      right[startSample + i] += s * rightGain;
    }
  };

  // Bass Note
  const addBassNote = (
    startTime: number,
    duration: number,
    freq: number,
    volume = 0.35
  ) => {
    const startSample = Math.floor(startTime * sampleRate);
    const noteSamples = Math.floor(duration * sampleRate);
    for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const env = Math.exp(-progress * 2.5) * volume;
      const wave =
        0.8 * Math.sin(2 * Math.PI * freq * t) +
        0.2 * Math.sin(4 * Math.PI * freq * t);
      const s = wave * env;
      left[startSample + i] += s;
      right[startSample + i] += s;
    }
  };

  // Sparkle Chime (for final victory pose)
  const addChime = (startTime: number, freq: number, volume = 0.2) => {
    const startSample = Math.floor(startTime * sampleRate);
    const chimeDuration = 0.5;
    const chimeSamples = Math.floor(chimeDuration * sampleRate);
    for (let i = 0; i < chimeSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / chimeDuration;
      const env = Math.exp(-progress * 6) * volume;
      const s = Math.sin(2 * Math.PI * freq * t) * env;
      left[startSample + i] += s * 0.8;
      right[startSample + i] += s * 0.95;
    }
  };

  // 1. Compose Drum Track
  for (let b = 0; b < 7; b++) {
    const t = b * beatSec;
    if (b === 0 || b === 2 || b === 4 || b === 6) addKick(t, 0.55);
    if (b === 1 || b === 3 || b === 5) addKick(t + sixteenthSec * 2, 0.42);
    if (b % 2 === 1) addSnare(t, 0.45);
    addHihat(t, 0.16);
    addHihat(t + sixteenthSec * 2, 0.2);
  }

  // 2. Compose Melodic Line & Bass
  const C3 = 130.81,
    F3 = 174.61,
    G3 = 196.0,
    A3 = 220.0;
  const C5 = 523.25,
    D5 = 587.33,
    E5 = 659.25,
    G5 = 783.99,
    A5 = 880.0;
  const C6 = 1046.5,
    D6 = 1174.66,
    E6 = 1318.51,
    G6 = 1567.98;

  // Beat 0: Intro bounce
  addBassNote(0 * beatSec, beatSec, C3, 0.35);
  addSynthNote(0 * beatSec, sixteenthSec * 1.5, C5, 0.28, -0.2);
  addSynthNote(sixteenthSec * 2, sixteenthSec * 1.5, E5, 0.3, 0.1);

  // Beat 1: Groove step
  addBassNote(1 * beatSec, beatSec, C3, 0.35);
  addSynthNote(1 * beatSec, sixteenthSec * 1.5, G5, 0.3, 0.2);
  addSynthNote(1 * beatSec + sixteenthSec * 2, sixteenthSec * 1.5, A5, 0.3, -0.1);

  // Beat 2: Kicks start!
  addBassNote(2 * beatSec, beatSec, F3, 0.38);
  addSynthNote(2 * beatSec, sixteenthSec * 1.5, C6, 0.34, 0.3);
  addSynthNote(2 * beatSec + sixteenthSec * 2, sixteenthSec * 1.5, A5, 0.3, -0.2);

  // Beat 3: Spin jump kick
  addBassNote(3 * beatSec, beatSec, G3, 0.38);
  addSynthNote(3 * beatSec, sixteenthSec * 1.2, G5, 0.3, 0.1);
  addSynthNote(3 * beatSec + sixteenthSec * 2, sixteenthSec * 1.5, E5, 0.28, -0.1);

  // Beat 4: Floorwork drop
  addBassNote(4 * beatSec, beatSec, A3, 0.38);
  addSynthNote(4 * beatSec, sixteenthSec * 1.2, C5, 0.28, -0.3);
  addSynthNote(4 * beatSec + sixteenthSec * 1.5, sixteenthSec * 1.2, E5, 0.3, 0.2);
  addSynthNote(4 * beatSec + sixteenthSec * 3, sixteenthSec * 1.2, G5, 0.32, -0.1);

  // Beat 5: Windmill roll / floor spin
  addBassNote(5 * beatSec, beatSec, G3, 0.38);
  addSynthNote(5 * beatSec, sixteenthSec * 1.2, A5, 0.32, 0.3);
  addSynthNote(5 * beatSec + sixteenthSec * 2, sixteenthSec * 1.2, C6, 0.34, -0.2);

  // Beat 6: Recovery pop-up
  addBassNote(6 * beatSec, beatSec, C3, 0.4);
  addSynthNote(6 * beatSec, sixteenthSec * 1.5, D6, 0.34, 0.1);
  addSynthNote(6 * beatSec + sixteenthSec * 2, sixteenthSec * 1.5, E6, 0.36, 0.0);

  // Beat 7 (2.85s - 3.40s): Triumphant Victory Chord & Sparkle Fanfare!
  const victoryTime = 6.8 * beatSec; // ~3.09s
  addKick(victoryTime, 0.58);
  addSnare(victoryTime, 0.48);
  addBassNote(victoryTime, 0.7, C3, 0.42);

  // Major Triad Chord: C5, E5, G5, C6
  addSynthNote(victoryTime, 0.65, C5, 0.3, -0.3);
  addSynthNote(victoryTime, 0.65, E5, 0.3, -0.1);
  addSynthNote(victoryTime, 0.65, G5, 0.34, 0.1);
  addSynthNote(victoryTime, 0.65, C6, 0.38, 0.3);

  // Sparkle Chimes
  addChime(victoryTime + 0.05, G6, 0.24);
  addChime(victoryTime + 0.12, C6 * 2, 0.22);
  addChime(victoryTime + 0.2, E6 * 2, 0.2);

  // Soft fade-out at the end
  const fadeSamples = Math.floor(0.12 * sampleRate);
  for (let i = 0; i < fadeSamples; i++) {
    const idx = totalSamples - fadeSamples + i;
    const factor = 1 - i / fadeSamples;
    left[idx] *= factor;
    right[idx] *= factor;
  }

  return buffer;
}

let cachedCelebrationBuffer: AudioBuffer | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let currentCelebrationAudio: HTMLAudioElement | null = null;

/**
 * Play synchronized breakbeat audio for Cappy's task-completion celebration.
 * Respects sound settings (soundEnabled) and plays via Web Audio API primary engine
 * (or HTMLAudioElement fallback).
 */
export function playBreakdanceCelebration(
  soundEnabled = true,
  onEnded?: () => void
): CelebrationAudioHandle | HTMLAudioElement | null {
  if (typeof window === "undefined" || !soundEnabled) {
    if (onEnded) {
      setTimeout(onEnded, 3400);
    }
    return null;
  }

  // Stop any ongoing celebration playback
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {}
    currentSourceNode = null;
  }
  if (currentCelebrationAudio) {
    try {
      currentCelebrationAudio.pause();
      currentCelebrationAudio.currentTime = 0;
    } catch {}
    currentCelebrationAudio = null;
  }

  let hasEnded = false;
  const finish = () => {
    if (hasEnded) return;
    hasEnded = true;
    currentSourceNode = null;
    currentCelebrationAudio = null;
    if (onEnded) onEnded();
  };

  // 1. Primary Engine: Web Audio API in-memory BufferSource
  const ctx = getContext();
  if (ctx) {
    try {
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      if (
        !cachedCelebrationBuffer ||
        cachedCelebrationBuffer.sampleRate !== ctx.sampleRate
      ) {
        cachedCelebrationBuffer = createCelebrationBuffer(ctx);
      }

      const source = ctx.createBufferSource();
      source.buffer = cachedCelebrationBuffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.85, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      currentSourceNode = source;
      source.onended = () => {
        finish();
      };

      source.start(ctx.currentTime);

      // Safe fallback timer
      setTimeout(finish, 3600);

      const handle: CelebrationAudioHandle = {
        pause: () => {
          try {
            source.stop();
            source.disconnect();
          } catch {}
          finish();
        },
        stop: () => {
          try {
            source.stop();
            source.disconnect();
          } catch {}
          finish();
        },
      };

      return handle;
    } catch (err) {
      console.warn(
        "[Pacana Audio] WebAudio celebration failed, falling back to HTMLAudioElement:",
        err
      );
    }
  }

  // 2. Secondary Engine: HTML5 Audio with real MP3 / WAV
  try {
    const audio = new Audio("/sounds/task-complete-breakdance.mp3");
    audio.volume = 0.85;
    currentCelebrationAudio = audio;

    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener(
      "error",
      () => {
        try {
          audio.src = "/sounds/task-complete-breakdance.wav";
          audio.play().catch(finish);
        } catch {
          finish();
        }
      },
      { once: true }
    );

    const fallbackTimer = setTimeout(finish, 3600);

    audio.play().catch(() => {
      clearTimeout(fallbackTimer);
      finish();
    });

    return audio;
  } catch {
    finish();
    return null;
  }
}

/**
 * Stop any ongoing breakdance celebration playback immediately.
 */
export function stopBreakdanceCelebration(): void {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {}
    currentSourceNode = null;
  }
  if (currentCelebrationAudio) {
    try {
      currentCelebrationAudio.pause();
      currentCelebrationAudio.currentTime = 0;
    } catch {}
    currentCelebrationAudio = null;
  }
}
