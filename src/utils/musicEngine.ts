import { MusicConfig, SynthPreset } from "@/types/profile";

type StateListener = (state: { isPlaying: boolean; isMuted: boolean }) => void;

class MusicController {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private synthTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private muted = false;
  private stepIndex = 0;
  private currentConfig: MusicConfig | null = null;
  private listeners = new Set<StateListener>();

  private initAudioEl() {
    if (typeof window === "undefined") return;
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.preload = "auto";
    }
  }

  public subscribe(fn: StateListener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const fn of this.listeners) {
      fn({ isPlaying: this.playing, isMuted: this.muted });
    }
  }

  private ensureContext() {
    if (typeof window === "undefined") return;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    this.syncVolume();
  }

  public getEffectiveVolume(cfg?: MusicConfig | null): number {
    if (this.muted) return 0;
    const c = cfg || this.currentConfig;
    const v = c && typeof c.volume === "number" ? c.volume : 70;
    return Math.max(0, Math.min(1, v / 100));
  }

  public syncVolume(cfg?: MusicConfig | null) {
    if (cfg) this.currentConfig = cfg;
    const vol = this.getEffectiveVolume(cfg);
    if (this.audioEl) {
      this.audioEl.volume = vol;
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(vol * 0.45, this.audioCtx.currentTime, 0.05);
    }
  }

  private playNote(
    freq: number,
    type: OscillatorType,
    duration: number,
    delay = 0,
    vol = 0.25,
    cutoff = 1800
  ) {
    if (!this.audioCtx || !this.masterGain || !this.playing) return;
    const t = this.audioCtx.currentTime + delay;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const g = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private playKick(delay = 0) {
    if (!this.audioCtx || !this.masterGain || !this.playing) return;
    const t = this.audioCtx.currentTime + delay;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.14);

    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private playHat(delay = 0, vol = 0.08) {
    if (!this.audioCtx || !this.masterGain || !this.playing) return;
    const t = this.audioCtx.currentTime + delay;
    const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.05);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(6000, t);

    const g = this.audioCtx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    noise.start(t);
  }

  private startSynthLoop(preset: SynthPreset) {
    this.stopSynthLoop();
    this.ensureContext();
    this.stepIndex = 0;

    const patterns: Record<
      SynthPreset,
      { tempo: number; bass: number[]; arp: number[] }
    > = {
      crimson: {
        tempo: 190,
        bass: [73.42, 73.42, 65.41, 58.27, 73.42, 73.42, 87.31, 82.41],
        arp: [293.66, 349.23, 440.0, 466.16, 440.0, 349.23, 293.66, 261.63],
      },
      phonk: {
        tempo: 165,
        bass: [65.41, 65.41, 77.78, 65.41, 61.74, 61.74, 65.41, 58.27],
        arp: [523.25, 622.25, 698.46, 622.25, 523.25, 466.16, 523.25, 783.99],
      },
      abyss: {
        tempo: 260,
        bass: [55.0, 55.0, 51.91, 55.0, 65.41, 61.74, 55.0, 49.0],
        arp: [220.0, 261.63, 329.63, 261.63, 246.94, 293.66, 220.0, 196.0],
      },
      lofi: {
        tempo: 280,
        bass: [110.0, 87.31, 98.0, 82.41, 110.0, 87.31, 98.0, 123.47],
        arp: [440.0, 523.25, 659.25, 587.33, 392.0, 493.88, 587.33, 523.25],
      },
    };

    const cfg = patterns[preset] || patterns.crimson;

    const tickStep = () => {
      if (!this.playing) return;
      const i = this.stepIndex % 8;
      const bFreq = cfg.bass[i];
      const aFreq = cfg.arp[i];

      if (preset === "phonk") {
        if (i % 2 === 0) this.playKick(0);
        this.playHat(0, 0.11);
        this.playNote(bFreq, "sawtooth", 0.25, 0, 0.28, 420);
        this.playNote(aFreq, "square", 0.14, 0, 0.22, 2400);
      } else if (preset === "abyss") {
        if (i === 0 || i === 4) this.playKick(0);
        this.playNote(bFreq, "sawtooth", 0.45, 0, 0.3, 380);
        if (i % 2 === 1) this.playNote(aFreq, "triangle", 0.35, 0, 0.16, 1200);
      } else if (preset === "lofi") {
        if (i === 0 || i === 5) this.playKick(0);
        if (i % 2 === 1) this.playHat(0, 0.05);
        this.playNote(bFreq, "sine", 0.4, 0, 0.24, 600);
        this.playNote(aFreq, "triangle", 0.38, 0, 0.15, 1100);
      } else {
        if (i % 2 === 0) this.playKick(0);
        if (i % 2 === 1) this.playHat(0, 0.08);
        this.playNote(bFreq, "sawtooth", 0.28, 0, 0.26, 650);
        this.playNote(aFreq, "sawtooth", 0.18, 0, 0.18, 1950);
      }

      this.stepIndex++;
      this.synthTimer = setTimeout(tickStep, cfg.tempo);
    };

    tickStep();
  }

  private stopSynthLoop() {
    if (this.synthTimer) {
      clearTimeout(this.synthTimer);
      this.synthTimer = null;
    }
  }

  public async play(cfg?: MusicConfig) {
    this.initAudioEl();
    if (cfg) this.currentConfig = cfg;
    const m = this.currentConfig;
    if (!m || !m.enabled) return;

    this.stopSynthLoop();
    if (this.audioEl) this.audioEl.pause();
    this.playing = true;
    this.syncVolume(m);

    const srcType = m.source || "synth";
    const customSrc =
      srcType === "upload" ? m.dataUrl || m.url : srcType === "url" ? m.url : "";

    if ((srcType === "upload" || srcType === "url") && customSrc && this.audioEl) {
      try {
        if (this.audioEl.src !== customSrc) {
          this.audioEl.src = customSrc;
        }
        await this.audioEl.play();
      } catch (err) {
        console.warn("Audio externo falló, activando sintetizador de respaldo:", err);
        this.startSynthLoop(m.preset || "crimson");
      }
    } else {
      this.startSynthLoop(m.preset || "crimson");
    }

    this.notify();
  }

  public pause() {
    this.playing = false;
    this.stopSynthLoop();
    if (this.audioEl) this.audioEl.pause();
    this.notify();
  }

  public stop() {
    this.pause();
  }

  public toggle(cfg?: MusicConfig) {
    if (this.playing) this.pause();
    else this.play(cfg);
  }

  public setVolume(val: number, cfg?: MusicConfig) {
    if (cfg) this.currentConfig = { ...cfg, volume: val };
    else if (this.currentConfig) this.currentConfig.volume = val;

    if (val > 0 && this.muted) {
      this.muted = false;
    }
    this.syncVolume();
    this.notify();
  }

  public toggleMute() {
    this.muted = !this.muted;
    this.syncVolume();
    this.notify();
  }

  public isPlaying() {
    return this.playing;
  }

  public isMuted() {
    return this.muted;
  }
}

export const musicEngine = new MusicController();

