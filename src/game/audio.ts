import { LEVELS } from './constants';

interface TrackPattern {
  bass: number[]; // MIDI note offsets (0 = rest)
  arp: number[]; // MIDI note offsets (0 = rest)
  lead: number[]; // MIDI note offsets (0 = rest)
  kickPattern: number[]; // 16 steps
  snarePattern: number[]; // 16 steps
  hatPattern: number[]; // 16 steps
}

// 5 distinct modern electronic/synthwave progressions matching the 5 levels
const LEVEL_TRACKS: TrackPattern[] = [
  // Level 1 (118 BPM) - Midnight cruising darkwave groove (A minor)
  {
    bass: [45, 0, 45, 0, 45, 0, 48, 0, 41, 0, 41, 0, 43, 0, 40, 0],
    arp: [69, 0, 72, 0, 76, 0, 72, 0, 65, 0, 69, 0, 67, 0, 71, 0],
    lead: [0, 0, 0, 0, 81, 0, 0, 79, 0, 0, 76, 0, 0, 0, 72, 0],
    kickPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  },
  // Level 2 (128 BPM) - Electric Indigo driving synth-house (C minor)
  {
    bass: [48, 48, 0, 48, 51, 0, 48, 0, 44, 44, 0, 44, 46, 0, 43, 0],
    arp: [72, 75, 79, 75, 72, 75, 79, 84, 68, 72, 75, 72, 70, 74, 79, 74],
    lead: [84, 0, 0, 82, 0, 0, 79, 0, 80, 0, 79, 0, 75, 0, 74, 0],
    kickPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hatPattern: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0],
  },
  // Level 3 (138 BPM) - Solar Amber neon electro (D minor)
  {
    bass: [50, 50, 62, 50, 50, 50, 53, 50, 46, 46, 58, 46, 48, 48, 55, 48],
    arp: [74, 77, 81, 86, 81, 77, 74, 81, 70, 74, 77, 82, 72, 76, 79, 84],
    lead: [86, 0, 84, 0, 81, 0, 77, 81, 82, 0, 81, 0, 79, 0, 76, 0],
    kickPattern: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  },
  // Level 4 (150 BPM) - Red Zone dark techno-trance (E minor)
  {
    bass: [52, 52, 64, 52, 55, 52, 64, 52, 48, 48, 60, 48, 50, 50, 62, 50],
    arp: [76, 79, 83, 88, 83, 79, 88, 83, 72, 76, 79, 84, 74, 78, 81, 86],
    lead: [88, 88, 0, 86, 83, 0, 79, 83, 84, 0, 83, 0, 81, 78, 76, 0],
    kickPattern: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
    hatPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  // Level 5 (164 BPM) - Hyper Turek adrenaline overdrive (F# minor)
  {
    bass: [54, 66, 54, 66, 57, 69, 54, 66, 50, 62, 50, 62, 52, 64, 56, 68],
    arp: [78, 81, 85, 90, 85, 81, 90, 93, 74, 78, 81, 86, 76, 80, 83, 88],
    lead: [90, 0, 88, 90, 93, 0, 90, 88, 86, 85, 81, 85, 88, 0, 83, 88],
    kickPattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1],
    hatPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class TurekAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private isPlayingMusic = false;
  private currentLevel = 1;
  private speedBoostBpm = 0;

  private stepIndex = 0;
  private nextStepTime = 0;
  private schedulerTimer: number | null = null;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.78;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate short white noise buffer for snare, hi-hat, and crash SFX
      const sampleRate = this.ctx.sampleRate;
      const len = Math.floor(sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, len, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setLevel(level: number, speedStep = 0): void {
    this.currentLevel = Math.max(1, Math.min(5, level));
    // Subtle extra BPM push as speed increments every 10 points within a level
    this.speedBoostBpm = Math.min(10, (speedStep % 3) * 2.5);
  }

  public startMusic(level = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.currentLevel = Math.max(1, Math.min(5, level));
    this.speedBoostBpm = 0;

    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    this.schedulerTimer = window.setInterval(() => {
      this.scheduleSteps();
    }, 28);
  }

  public stopMusic(): void {
    this.isPlayingMusic = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleSteps(): void {
    if (!this.isPlayingMusic || !this.ctx || !this.musicGain) return;
    const lookAhead = 0.12;
    while (this.nextStepTime < this.ctx.currentTime + lookAhead) {
      this.triggerStep(this.stepIndex, this.nextStepTime);
      const levelCfg = LEVELS[this.currentLevel - 1] ?? LEVELS[0];
      const bpm = levelCfg.bpm + this.speedBoostBpm;
      const sixteenthDuration = 60 / bpm / 4;
      this.nextStepTime += sixteenthDuration;
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  private triggerStep(step: number, time: number): void {
    if (!this.ctx || !this.musicGain || this.muted) return;
    const track = LEVEL_TRACKS[this.currentLevel - 1] ?? LEVEL_TRACKS[0];

    if (track.kickPattern[step]) {
      this.playKick(time);
    }
    if (track.snarePattern[step]) {
      this.playSnare(time);
    }
    if (track.hatPattern[step]) {
      this.playHat(time, step % 4 === 2 ? 0.12 : 0.06);
    }

    const bassNote = track.bass[step];
    if (bassNote > 0) {
      this.playBass(midiToFreq(bassNote), time, 0.16);
    }

    const arpNote = track.arp[step];
    if (arpNote > 0) {
      this.playArp(midiToFreq(arpNote), time, 0.13);
    }

    const leadNote = track.lead[step];
    if (leadNote > 0 && this.currentLevel >= 2) {
      this.playLead(midiToFreq(leadNote), time, 0.24);
    }
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.19);
  }

  private playSnare(time: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1100, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.13);
  }

  private playHat(time: number, vol: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.05);
  }

  private playBass(freq: number, time: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(620 + this.currentLevel * 120, time);
    filter.frequency.exponentialRampToValueAtTime(190, time + dur);

    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playArp(freq: number, time: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = this.currentLevel >= 4 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, time);

    gain.gain.setValueAtTime(0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playLead(freq: number, time: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, time);

    gain.gain.setValueAtTime(0.075, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  // --- Arcade SFX ---

  public playLaneShift(dir: -1 | 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startFreq = dir < 0 ? 310 : 350;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, now + 0.055);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playDodgePoint(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playAmbulanceBonus(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;

    // Punchy metallic crunch + triumphant arcade power-chime + quick siren blip
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.25);
    });

    // Sub punch
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.19);
  }

  public playSpeedUp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.22);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playLevelUp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880, 1108.73];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;

    // Noise burst
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.42);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.46);
    }

    // Heavy metallic thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.35);
    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
