import { MusicConfig, SynthPreset } from "@/types/profile";

export type DetectedLinkKind =
  | "youtube"
  | "soundcloud"
  | "spotify"
  | "gdrive"
  | "dropbox"
  | "direct"
  | "none";

export interface DetectedAudioLink {
  kind: DetectedLinkKind;
  label: string;
  cleanUrl: string;
  youtubeId?: string;
  spotifyType?: string;
  spotifyId?: string;
  spotifyEmbedUrl?: string;
}

export function detectAudioUrlType(rawUrl?: string | null): DetectedAudioLink {
  const url = (rawUrl || "").trim();
  if (!url) {
    return { kind: "none", label: "Sin enlace", cleanUrl: "" };
  }

  // 1. YouTube / YouTube Music / YouTube Shorts / youtu.be
  const ytMatch =
    url.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    ) || url.match(/^([a-zA-Z0-9_-]{11})$/);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      kind: "youtube",
      label: "YouTube / YT Music",
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
      youtubeId: videoId,
    };
  }

  // 2. Spotify (track, playlist, album, episode)
  const spMatch = url.match(
    /open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(track|playlist|album|episode|artist)\/([a-zA-Z0-9]+)/
  );
  if (spMatch && spMatch[1] && spMatch[2]) {
    const spotifyType = spMatch[1];
    const spotifyId = spMatch[2];
    return {
      kind: "spotify",
      label: `Spotify (${spotifyType})`,
      cleanUrl: url,
      spotifyType,
      spotifyId,
      spotifyEmbedUrl: `https://open.spotify.com/embed/${spotifyType}/${spotifyId}?utm_source=generator&theme=0`,
    };
  }

  // 3. SoundCloud
  if (url.includes("soundcloud.com/")) {
    return {
      kind: "soundcloud",
      label: "SoundCloud",
      cleanUrl: url.split("?")[0],
    };
  }

  // 4. Google Drive
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const directDrive = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    return {
      kind: "gdrive",
      label: "Google Drive Audio",
      cleanUrl: `/api/audio-proxy?url=${encodeURIComponent(directDrive)}`,
    };
  }

  // 5. Dropbox
  if (url.includes("dropbox.com")) {
    const directDropbox = url
      .replace("www.dropbox.com", "dl.dropboxusercontent.com")
      .replace("dropbox.com", "dl.dropboxusercontent.com")
      .replace(/[?&]dl=0/, "")
      .replace(/[?&]dl=1/, "");
    return {
      kind: "dropbox",
      label: "Dropbox Audio",
      cleanUrl: directDropbox,
    };
  }

  // 6. GitHub blob -> raw
  if (url.includes("github.com") && url.includes("/blob/")) {
    const rawGh = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
    return {
      kind: "direct",
      label: "GitHub Raw Audio",
      cleanUrl: rawGh,
    };
  }

  // 7. Cualquier enlace directo (.mp3, .ogg, .wav, .m4a, stream)
  return {
    kind: "direct",
    label: "Audio Directo / Stream",
    cleanUrl: url,
  };
}

type StateListener = (state: {
  isPlaying: boolean;
  isMuted: boolean;
  error?: string | null;
}) => void;

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

interface SCWidgetInstance {
  play: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  seekTo: (ms: number) => void;
  load: (url: string, options?: Record<string, unknown>) => void;
  bind: (event: string, listener: () => void) => void;
}

class MusicController {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private synthTimer: ReturnType<typeof setTimeout> | null = null;

  // YouTube IFrame API state
  private ytPlayer: YTPlayerInstance | null = null;
  private ytReady = false;
  private ytVideoId: string | null = null;
  private ytApiLoading: Promise<void> | null = null;

  // SoundCloud Widget API state
  private scWidget: SCWidgetInstance | null = null;
  private scIframe: HTMLIFrameElement | null = null;
  private scReady = false;
  private scTrackUrl: string | null = null;
  private scApiLoading: Promise<void> | null = null;

  private activeEngine: "none" | "synth" | "html5" | "youtube" | "soundcloud" =
    "none";
  private playing = false;
  private muted = false;
  private lastError: string | null = null;
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
      fn({
        isPlaying: this.playing,
        isMuted: this.muted,
        error: this.lastError,
      });
    }
  }

  private ensureContext() {
    if (typeof window === "undefined") return;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
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
    const vol100 = Math.round(vol * 100);

    if (this.audioEl) {
      this.audioEl.volume = vol;
      this.audioEl.muted = this.muted;
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        vol * 0.45,
        this.audioCtx.currentTime,
        0.05
      );
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        if (this.muted || vol100 === 0) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(vol100);
        }
      } catch {}
    }
    if (this.scWidget && this.scReady) {
      try {
        this.scWidget.setVolume(this.muted ? 0 : vol100);
      } catch {}
    }
  }

  // =========================================================================
  // YOUTUBE IFRAME API ENGINE
  // =========================================================================
  private loadYouTubeApi(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    const w = window as unknown as {
      YT?: { Player?: unknown };
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT && w.YT.Player) return Promise.resolve();
    if (this.ytApiLoading) return this.ytApiLoading;

    this.ytApiLoading = new Promise<void>((resolve) => {
      const prevCallback = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        resolve();
      };
      const existing = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.head.appendChild(tag);
      }
    });

    return this.ytApiLoading;
  }

  private async playYouTube(videoId: string) {
    if (typeof window === "undefined") return;
    await this.loadYouTubeApi();

    const w = window as unknown as {
      YT: {
        Player: new (
          elId: string,
          opts: Record<string, unknown>
        ) => YTPlayerInstance;
        PlayerState: {
          ENDED: number;
          PLAYING: number;
          PAUSED: number;
        };
      };
    };

    // Si ya existe el reproductor de YouTube, cargamos o reanudamos el video
    if (this.ytPlayer && this.ytReady) {
      if (this.ytVideoId !== videoId) {
        this.ytVideoId = videoId;
        this.ytPlayer.loadVideoById(videoId);
      }
      this.syncVolume();
      this.ytPlayer.playVideo();
      return;
    }

    // Crear contenedor oculto si no existe
    let host = document.getElementById("nexus-yt-bgm-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "nexus-yt-bgm-host";
      host.style.position = "fixed";
      host.style.left = "-9999px";
      host.style.bottom = "-9999px";
      host.style.width = "1px";
      host.style.height = "1px";
      host.style.opacity = "0";
      host.style.pointerEvents = "none";
      const inner = document.createElement("div");
      inner.id = "nexus-yt-bgm-player";
      host.appendChild(inner);
      document.body.appendChild(host);
    }

    this.ytVideoId = videoId;
    this.ytReady = false;

    this.ytPlayer = new w.YT.Player("nexus-yt-bgm-player", {
      height: "1",
      width: "1",
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        loop: 1,
        playlist: videoId,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          this.ytReady = true;
          this.syncVolume();
          if (this.playing && this.activeEngine === "youtube") {
            try {
              this.ytPlayer?.playVideo();
            } catch {}
          }
        },
        onStateChange: (event: { data: number }) => {
          if (event.data === w.YT.PlayerState.ENDED) {
            try {
              this.ytPlayer?.seekTo(0, true);
              this.ytPlayer?.playVideo();
            } catch {}
          } else if (event.data === w.YT.PlayerState.PLAYING) {
            this.playing = true;
            this.lastError = null;
            this.notify();
          }
        },
        onError: () => {
          this.lastError =
            "Este video de YouTube no permite reproducción incrustada. Prueba con otro enlace.";
          this.playing = false;
          this.notify();
        },
      },
    });
  }

  private stopYouTube() {
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }
  }

  // =========================================================================
  // SOUNDCLOUD WIDGET API ENGINE
  // =========================================================================
  private loadSoundCloudApi(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    const w = window as unknown as { SC?: { Widget?: unknown } };
    if (w.SC && w.SC.Widget) return Promise.resolve();
    if (this.scApiLoading) return this.scApiLoading;

    this.scApiLoading = new Promise<void>((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "https://w.soundcloud.com/player/api.js";
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => reject(new Error("No se pudo cargar SoundCloud API"));
      document.head.appendChild(tag);
    });

    return this.scApiLoading;
  }

  private async playSoundCloud(trackUrl: string) {
    if (typeof window === "undefined") return;
    await this.loadSoundCloudApi();

    const w = window as unknown as {
      SC: {
        Widget: ((iframe: HTMLIFrameElement) => SCWidgetInstance) & {
          Events: {
            READY: string;
            FINISH: string;
            PLAY: string;
            ERROR: string;
          };
        };
      };
    };

    if (this.scWidget && this.scReady) {
      if (this.scTrackUrl !== trackUrl) {
        this.scTrackUrl = trackUrl;
        this.scWidget.load(trackUrl, {
          auto_play: true,
          callback: () => {
            this.syncVolume();
            this.scWidget?.play();
          },
        });
      } else {
        this.syncVolume();
        this.scWidget.play();
      }
      return;
    }

    if (!this.scIframe) {
      const iframe = document.createElement("iframe");
      iframe.id = "nexus-sc-bgm-player";
      iframe.allow = "autoplay";
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.bottom = "-9999px";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        trackUrl
      )}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`;
      document.body.appendChild(iframe);
      this.scIframe = iframe;
    }

    this.scTrackUrl = trackUrl;
    this.scReady = false;
    this.scWidget = w.SC.Widget(this.scIframe);

    this.scWidget.bind(w.SC.Widget.Events.READY, () => {
      this.scReady = true;
      this.syncVolume();
      if (this.playing && this.activeEngine === "soundcloud") {
        this.scWidget?.play();
      }
    });

    this.scWidget.bind(w.SC.Widget.Events.FINISH, () => {
      this.scWidget?.seekTo(0);
      this.scWidget?.play();
    });

    this.scWidget.bind(w.SC.Widget.Events.ERROR, () => {
      this.lastError = "No se pudo cargar la pista de SoundCloud.";
      this.playing = false;
      this.notify();
    });
  }

  private stopSoundCloud() {
    if (this.scWidget && this.scReady) {
      try {
        this.scWidget.pause();
      } catch {}
    }
  }

  // =========================================================================
  // WEBAUDIO SYNTHESIZER ENGINE
  // =========================================================================
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
    const buffer = this.audioCtx.createBuffer(
      1,
      bufferSize,
      this.audioCtx.sampleRate
    );
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
      if (!this.playing || this.activeEngine !== "synth") return;
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
        if (i % 2 === 1)
          this.playNote(aFreq, "triangle", 0.35, 0, 0.16, 1200);
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

  private stopAllEngines() {
    this.stopSynthLoop();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {}
    }
    this.stopYouTube();
    this.stopSoundCloud();
  }

  // =========================================================================
  // UNIVERSAL PLAY / PAUSE / TOGGLE
  // =========================================================================
  public async play(cfg?: MusicConfig) {
    this.initAudioEl();
    if (cfg) this.currentConfig = cfg;
    const m = this.currentConfig;
    if (!m || !m.enabled) return;

    this.stopAllEngines();
    this.lastError = null;
    this.playing = true;
    this.syncVolume(m);

    // Determinar la fuente efectiva: si el usuario puso una URL y seleccionó "url" (o si tiene una URL activa)
    const srcType = m.source || "synth";

    // CASO 1: Archivo subido ("upload")
    if (srcType === "upload") {
      const uploadSrc = (m.dataUrl || m.url || "").trim();
      if (!uploadSrc) {
        this.lastError = "Sube un archivo de audio (.mp3, .ogg, .wav) primero.";
        this.playing = false;
        this.notify();
        return;
      }
      this.activeEngine = "html5";
      await this.playHtml5Audio(uploadSrc, false);
      this.notify();
      return;
    }

    // CASO 2: Link externo ("url")
    if (srcType === "url") {
      const rawUrl = (m.url || "").trim();
      if (!rawUrl) {
        this.lastError = "Pega un enlace de YouTube, SoundCloud, Spotify o MP3.";
        this.playing = false;
        this.notify();
        return;
      }

      const detected = detectAudioUrlType(rawUrl);

      if (detected.kind === "youtube" && detected.youtubeId) {
        this.activeEngine = "youtube";
        this.notify();
        await this.playYouTube(detected.youtubeId);
        return;
      }

      if (detected.kind === "soundcloud") {
        this.activeEngine = "soundcloud";
        this.notify();
        await this.playSoundCloud(detected.cleanUrl);
        return;
      }

      if (detected.kind === "spotify") {
        // Spotify se reproduce mediante su reproductor incrustado oficial en el HUD
        this.activeEngine = "none";
        this.playing = false;
        this.notify();
        return;
      }

      // Enlace directo (.mp3, .ogg, Dropbox, Google Drive, etc.)
      this.activeEngine = "html5";
      await this.playHtml5Audio(detected.cleanUrl, true, rawUrl);
      this.notify();
      return;
    }

    // CASO 3: Sintetizador WebAudio ("synth")
    this.activeEngine = "synth";
    this.startSynthLoop(m.preset || "crimson");
    this.notify();
  }

  private async playHtml5Audio(
    src: string,
    allowProxyFallback: boolean,
    originalUrl?: string
  ) {
    if (!this.audioEl) return;

    try {
      if (this.audioEl.src !== src) {
        this.audioEl.src = src;
        this.audioEl.load();
      }
      await this.audioEl.play();
      this.lastError = null;
    } catch (firstErr) {
      // Si el enlace externo falló por CORS / Hotlink / Referer, reintentar vía /api/audio-proxy
      if (
        allowProxyFallback &&
        originalUrl &&
        originalUrl.startsWith("http") &&
        !src.startsWith("/api/audio-proxy")
      ) {
        try {
          const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(
            originalUrl
          )}`;
          this.audioEl.src = proxiedUrl;
          this.audioEl.load();
          await this.audioEl.play();
          this.lastError = null;
          return;
        } catch (proxyErr) {
          console.warn("Proxy audio playback failed:", proxyErr);
        }
      }

      console.warn("HTML5 audio playback error:", firstErr);
      this.playing = false;
      this.lastError =
        "No se pudo reproducir el enlace. Usa un link de YouTube, SoundCloud, Spotify o un archivo .mp3 directo.";
    }
  }

  public pause() {
    this.playing = false;
    this.stopAllEngines();
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

  public getLastError() {
    return this.lastError;
  }
}

export const musicEngine = new MusicController();
