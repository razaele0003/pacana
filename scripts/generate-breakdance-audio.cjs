const fs = require('fs');
const path = require('path');

// Generate 44.1kHz 16-bit Stereo PCM WAV file
const SAMPLE_RATE = 44100;
const DURATION_SEC = 3.4;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

const leftChannel = new Float32Array(TOTAL_SAMPLES);
const rightChannel = new Float32Array(TOTAL_SAMPLES);

const BPM = 132;
const BEAT_SEC = 60 / BPM; // ~0.4545s
const SIXTEENTH_SEC = BEAT_SEC / 4; // ~0.1136s

// Helper: Add Kick
function addKick(startTime, volume = 0.5) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const kickDuration = 0.18;
  const kickSamples = Math.floor(kickDuration * SAMPLE_RATE);

  for (let i = 0; i < kickSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / kickDuration;
    // Exponential pitch drop from 160Hz to 45Hz
    const freq = 45 + 115 * Math.exp(-progress * 18);
    const env = Math.exp(-progress * 9) * volume;
    const sample = Math.sin(2 * Math.PI * freq * t) * env;
    leftChannel[startSample + i] += sample * 0.9;
    rightChannel[startSample + i] += sample * 0.9;
  }
}

// Helper: Add Snare / Rimshot
function addSnare(startTime, volume = 0.35) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const snareDuration = 0.15;
  const snareSamples = Math.floor(snareDuration * SAMPLE_RATE);

  for (let i = 0; i < snareSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / snareDuration;
    const env = Math.exp(-progress * 14) * volume;
    // Tone component (200Hz) + Noise component
    const tone = Math.sin(2 * Math.PI * 210 * t) * 0.4;
    const noise = (Math.random() * 2 - 1) * 0.6;
    const sample = (tone + noise) * env;
    leftChannel[startSample + i] += sample * 0.85;
    rightChannel[startSample + i] += sample * 0.85;
  }
}

// Helper: Add Hihat
function addHihat(startTime, volume = 0.18) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const hatDuration = 0.05;
  const hatSamples = Math.floor(hatDuration * SAMPLE_RATE);

  for (let i = 0; i < hatSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const progress = i / hatSamples;
    const env = Math.exp(-progress * 22) * volume;
    const noise = (Math.random() * 2 - 1) * env;
    leftChannel[startSample + i] += noise * 0.7;
    rightChannel[startSample + i] += noise * 0.9;
  }
}

// Helper: Add Synth Note (warm square/triangle chiptune)
function addSynthNote(startTime, duration, freq, volume = 0.22, pan = 0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const noteSamples = Math.floor(duration * SAMPLE_RATE);

  for (let i = 0; i < noteSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Cozy ADSR envelope
    let env = 1.0;
    if (progress < 0.08) {
      env = progress / 0.08;
    } else {
      env = Math.exp(-(progress - 0.08) * 3.5);
    }
    env *= volume;

    // Harmonic blend: sine + warm 2nd harmonic + soft triangle
    const wave =
      0.6 * Math.sin(2 * Math.PI * freq * t) +
      0.25 * Math.sin(4 * Math.PI * freq * t) +
      0.15 * Math.sin(6 * Math.PI * freq * t);

    const s = wave * env;
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);

    leftChannel[startSample + i] += s * leftGain;
    rightChannel[startSample + i] += s * rightGain;
  }
}

// Helper: Add Bass Note
function addBassNote(startTime, duration, freq, volume = 0.28) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const noteSamples = Math.floor(duration * SAMPLE_RATE);

  for (let i = 0; i < noteSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;
    const env = Math.exp(-progress * 2.5) * volume;
    // Sub-bass sine + warm overtone
    const wave = 0.8 * Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(4 * Math.PI * freq * t);
    const s = wave * env;
    leftChannel[startSample + i] += s;
    rightChannel[startSample + i] += s;
  }
}

// Helper: Add Sparkle Chime (for final victory pose)
function addChime(startTime, freq, volume = 0.15) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const chimeDuration = 0.5;
  const chimeSamples = Math.floor(chimeDuration * SAMPLE_RATE);

  for (let i = 0; i < chimeSamples && startSample + i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / chimeDuration;
    const env = Math.exp(-progress * 6) * volume;
    const s = Math.sin(2 * Math.PI * freq * t) * env;
    leftChannel[startSample + i] += s * 0.8;
    rightChannel[startSample + i] += s * 0.95;
  }
}

// 1. Compose Drum Track
for (let b = 0; b < 7; b++) {
  const t = b * BEAT_SEC;

  // Kick on beat 0, 2, 4, 6 and syncopated 16ths
  if (b === 0 || b === 2 || b === 4 || b === 6) {
    addKick(t, 0.45);
  }
  if (b === 1 || b === 3 || b === 5) {
    addKick(t + SIXTEENTH_SEC * 2, 0.35); // syncopated kick
  }

  // Snare on beat 1, 3, 5
  if (b % 2 === 1) {
    addSnare(t, 0.38);
  }

  // Hi-hats on 8th notes
  addHihat(t, 0.12);
  addHihat(t + SIXTEENTH_SEC * 2, 0.15);
}

// 2. Compose Melodic Line & Bass
// Frequencies (Hz)
const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, A3 = 220.00;
const C4 = 261.63, E4 = 329.63, G4 = 392.00, A4 = 440.00;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880.00;
const C6 = 1046.50, D6 = 1174.66, E6 = 1318.51, G6 = 1567.98;

// Beat 0: Intro bounce
addBassNote(0 * BEAT_SEC, BEAT_SEC, C3, 0.28);
addSynthNote(0 * BEAT_SEC, SIXTEENTH_SEC * 1.5, C5, 0.22, -0.2);
addSynthNote(SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.5, E5, 0.24, 0.1);

// Beat 1: Groove step
addBassNote(1 * BEAT_SEC, BEAT_SEC, C3, 0.28);
addSynthNote(1 * BEAT_SEC, SIXTEENTH_SEC * 1.5, G5, 0.25, 0.2);
addSynthNote(1 * BEAT_SEC + SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.5, A5, 0.25, -0.1);

// Beat 2: Kicks start!
addBassNote(2 * BEAT_SEC, BEAT_SEC, F3, 0.3);
addSynthNote(2 * BEAT_SEC, SIXTEENTH_SEC * 1.5, C6, 0.28, 0.3);
addSynthNote(2 * BEAT_SEC + SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.5, A5, 0.24, -0.2);

// Beat 3: Spin jump kick
addBassNote(3 * BEAT_SEC, BEAT_SEC, G3, 0.3);
addSynthNote(3 * BEAT_SEC, SIXTEENTH_SEC * 1.2, G5, 0.25, 0.1);
addSynthNote(3 * BEAT_SEC + SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.5, E5, 0.23, -0.1);

// Beat 4: Floorwork drop
addBassNote(4 * BEAT_SEC, BEAT_SEC, A3, 0.3);
addSynthNote(4 * BEAT_SEC, SIXTEENTH_SEC * 1.2, C5, 0.22, -0.3);
addSynthNote(4 * BEAT_SEC + SIXTEENTH_SEC * 1.5, SIXTEENTH_SEC * 1.2, E5, 0.24, 0.2);
addSynthNote(4 * BEAT_SEC + SIXTEENTH_SEC * 3, SIXTEENTH_SEC * 1.2, G5, 0.26, -0.1);

// Beat 5: Windmill roll / floor spin
addBassNote(5 * BEAT_SEC, BEAT_SEC, G3, 0.3);
addSynthNote(5 * BEAT_SEC, SIXTEENTH_SEC * 1.2, A5, 0.26, 0.3);
addSynthNote(5 * BEAT_SEC + SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.2, C6, 0.28, -0.2);

// Beat 6: Recovery pop-up
addBassNote(6 * BEAT_SEC, BEAT_SEC, C3, 0.32);
addSynthNote(6 * BEAT_SEC, SIXTEENTH_SEC * 1.5, D6, 0.28, 0.1);
addSynthNote(6 * BEAT_SEC + SIXTEENTH_SEC * 2, SIXTEENTH_SEC * 1.5, E6, 0.3, 0.0);

// Beat 7 (2.85s - 3.40s): Triumphant Victory Chord & Sparkle Fanfare!
const victoryTime = 6.8 * BEAT_SEC; // ~3.09s
addKick(victoryTime, 0.5);
addSnare(victoryTime, 0.4);
addBassNote(victoryTime, 0.7, C3, 0.35);

// Major Triad Chord: C5, E5, G5, C6
addSynthNote(victoryTime, 0.65, C5, 0.25, -0.3);
addSynthNote(victoryTime, 0.65, E5, 0.25, -0.1);
addSynthNote(victoryTime, 0.65, G5, 0.28, 0.1);
addSynthNote(victoryTime, 0.65, C6, 0.32, 0.3);

// Sparkle Chimes
addChime(victoryTime + 0.05, G6, 0.18);
addChime(victoryTime + 0.12, C6 * 2, 0.16);
addChime(victoryTime + 0.20, E6 * 2, 0.14);

// Soft fade-out at the very end
const fadeSamples = Math.floor(0.12 * SAMPLE_RATE);
for (let i = 0; i < fadeSamples; i++) {
  const idx = TOTAL_SAMPLES - fadeSamples + i;
  const factor = 1 - i / fadeSamples;
  leftChannel[idx] *= factor;
  rightChannel[idx] *= factor;
}

// Convert to 16-bit PCM WAV
const pcmData = Buffer.alloc(TOTAL_SAMPLES * 4); // 2 channels * 2 bytes
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Soft limiter to prevent clipping
  const l = Math.max(-1, Math.min(1, leftChannel[i]));
  const r = Math.max(-1, Math.min(1, rightChannel[i]));
  const intL = l < 0 ? Math.floor(l * 32768) : Math.floor(l * 32767);
  const intR = r < 0 ? Math.floor(r * 32768) : Math.floor(r * 32767);
  pcmData.writeInt16LE(intL, i * 4);
  pcmData.writeInt16LE(intR, i * 4 + 2);
}

// Construct WAV Header (44 bytes)
const wavHeader = Buffer.alloc(44);
wavHeader.write('RIFF', 0);
wavHeader.writeUInt32LE(36 + pcmData.length, 4);
wavHeader.write('WAVE', 8);
wavHeader.write('fmt ', 12);
wavHeader.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
wavHeader.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
wavHeader.writeUInt16LE(2, 22); // numChannels (2 for stereo)
wavHeader.writeUInt32LE(SAMPLE_RATE, 24); // sampleRate
wavHeader.writeUInt32LE(SAMPLE_RATE * 4, 28); // byteRate (sampleRate * numChannels * bitsPerSample/8)
wavHeader.writeUInt16LE(4, 32); // blockAlign
wavHeader.writeUInt16LE(16, 34); // bitsPerSample
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(pcmData.length, 40);

const fullWav = Buffer.concat([wavHeader, pcmData]);

const SOUNDS_DIR = 'C:/Users/razae/Documents/ChatGPT/Pacana/public/sounds';
fs.mkdirSync(SOUNDS_DIR, { recursive: true });

// Write task-complete-breakdance.wav
const wavPath = path.join(SOUNDS_DIR, 'task-complete-breakdance.wav');
const mp3Path = path.join(SOUNDS_DIR, 'task-complete-breakdance.mp3');
fs.writeFileSync(wavPath, fullWav);

try {
  const { execSync } = require('child_process');
  execSync(`ffmpeg -y -i "${wavPath}" -codec:a libmp3lame -b:a 192k "${mp3Path}"`, { stdio: 'ignore' });
  console.log(`✔ Generated task-complete-breakdance audio (WAV & valid MP3) in ${SOUNDS_DIR}`);
} catch {
  console.log(`✔ Generated task-complete-breakdance audio (WAV) in ${SOUNDS_DIR}`);
}
