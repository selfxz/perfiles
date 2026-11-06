export type MusicSource = "synth" | "upload" | "url";
export type SynthPreset = "crimson" | "phonk" | "abyss" | "lofi";

export type CardStyle =
  | "terminal"
  | "glass"
  | "neon-cyber"
  | "hologram"
  | "minimal"
  | "arcade";

export type BgEffect =
  | "matrix"
  | "particles"
  | "embers"
  | "starfield"
  | "cybergrid"
  | "none";

export type AvatarStyle =
  | "orbit"
  | "plasma"
  | "hexagon"
  | "glitch-ring"
  | "crown-glow";

export type TitleEffect =
  | "glitch"
  | "neon-pulse"
  | "shimmer"
  | "cyber-wave"
  | "clean";

export type OrbStyle =
  | "halo"
  | "liquid"
  | "sonar"
  | "neon-ring"
  | "crystal";

export type EntryAnimation =
  | "cyber-boot"
  | "glitch-drop"
  | "portal-warp"
  | "neon-materialize"
  | "cinematic-fade"
  | "matrix-decode"
  | "none";

export type IntroScreenStyle =
  | "none"
  | "glass-blur"
  | "terminal-boot"
  | "cyber-gate"
  | "pulse-portal";

export interface VisualFxConfig {
  cardFloat: boolean;
  tilt3d: boolean;
  cursorGlow: boolean;
  scanlines: boolean;
  borderBeam: boolean;
}

export interface MusicConfig {
  enabled: boolean;
  autoPlay?: boolean;
  source: MusicSource;
  preset: SynthPreset;
  url: string;
  dataUrl: string;
  title: string;
  artist: string;
  volume: number;
}

export interface ProfileLink {
  id: string;
  name: string;
  handle: string;
  url: string;
  badge?: string;
}

export interface FeaturedRedirect {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
}

export interface CopyTag {
  id: string;
  icon: string;
  label: string;
  value: string;
}

export interface ProfileData {
  slug: string;
  user: string;
  host: string;
  place: string;
  tz: string;
  tagline: string[];
  role: string;
  vibe: string;
  verified?: boolean;
  avatar: string;
  accentColor?: string;
  secondaryColor?: string;
  rainEnabled?: boolean;
  cardStyle?: CardStyle;
  bgEffect?: BgEffect;
  avatarStyle?: AvatarStyle;
  titleEffect?: TitleEffect;
  orbStyle?: OrbStyle;
  entryAnimation?: EntryAnimation;
  introScreen?: IntroScreenStyle;
  introText?: string;
  visualFx?: VisualFxConfig;
  music: MusicConfig;
  links: ProfileLink[];
  featuredLinks: FeaturedRedirect[];
  copyTags: CopyTag[];
  updatedAt?: string;
}

export interface AdminConfig {
  passwordHash: string | null;
  defaultSlug?: string;
  updatedAt?: string;
}

export const PRESET_NAMES: Record<SynthPreset, string> = {
  crimson: "Cyber Crimson Synth",
  phonk: "Night Drive Phonk",
  abyss: "Dark Abyss Pulse",
  lofi: "Lo-Fi Neon Rain",
};

export const THEME_PRESETS: Array<{
  id: string;
  name: string;
  color: string;
  secondary: string;
}> = [
  { id: "crimson", name: "Rojo Carmesí", color: "#ff1a35", secondary: "#ffffff" },
  { id: "cyan", name: "Cyber Cyan", color: "#00f0ff", secondary: "#7c3aed" },
  { id: "violet", name: "Violeta Neón", color: "#a855f7", secondary: "#00f0ff" },
  { id: "emerald", name: "Matrix Verde", color: "#10b981", secondary: "#a7f3d0" },
  { id: "amber", name: "Oro Solar", color: "#f59e0b", secondary: "#fef08a" },
  { id: "rose", name: "Rosa Laser", color: "#ff2a85", secondary: "#38bdf8" },
  { id: "ice", name: "Hielo Ártico", color: "#38bdf8", secondary: "#e0f2fe" },
  { id: "toxic", name: "Ácido Bio", color: "#84cc16", secondary: "#22d3ee" },
  { id: "sunset", name: "Atardecer Tokio", color: "#fb7185", secondary: "#f59e0b" },
  { id: "ghost", name: "Blanco Fantasma", color: "#f8fafc", secondary: "#94a3b8" },
];

export const FULL_STYLE_PRESETS: Array<{
  id: string;
  name: string;
  desc: string;
  accentColor: string;
  secondaryColor: string;
  cardStyle: CardStyle;
  bgEffect: BgEffect;
  avatarStyle: AvatarStyle;
  titleEffect: TitleEffect;
  orbStyle: OrbStyle;
  visualFx: VisualFxConfig;
}> = [
  {
    id: "cyber-crimson",
    name: "🔥 Cyber Terminal",
    desc: "Lluvia Matrix + Glitch + Órbitas Neón",
    accentColor: "#ff1a35",
    secondaryColor: "#ffffff",
    cardStyle: "terminal",
    bgEffect: "matrix",
    avatarStyle: "orbit",
    titleEffect: "glitch",
    orbStyle: "halo",
    visualFx: {
      cardFloat: false,
      tilt3d: true,
      cursorGlow: true,
      scanlines: true,
      borderBeam: true,
    },
  },
  {
    id: "holo-glass",
    name: "💎 Cristal Holográfico",
    desc: "Glassmorphism + Red de Partículas + Shimmer",
    accentColor: "#00f0ff",
    secondaryColor: "#a855f7",
    cardStyle: "hologram",
    bgEffect: "particles",
    avatarStyle: "plasma",
    titleEffect: "shimmer",
    orbStyle: "crystal",
    visualFx: {
      cardFloat: true,
      tilt3d: true,
      cursorGlow: true,
      scanlines: false,
      borderBeam: true,
    },
  },
  {
    id: "mecha-hud",
    name: "⚡ Mecha Reactor HUD",
    desc: "Bordes Biselados + Hexágono + Radar Sonar",
    accentColor: "#f59e0b",
    secondaryColor: "#ff1a35",
    cardStyle: "neon-cyber",
    bgEffect: "cybergrid",
    avatarStyle: "hexagon",
    titleEffect: "neon-pulse",
    orbStyle: "neon-ring",
    visualFx: {
      cardFloat: false,
      tilt3d: true,
      cursorGlow: true,
      scanlines: true,
      borderBeam: true,
    },
  },
  {
    id: "inferno-embers",
    name: "🌋 Brasas & Plasma",
    desc: "Chispas Ascendentes + Enlaces Líquidos",
    accentColor: "#ff2a85",
    secondaryColor: "#f59e0b",
    cardStyle: "glass",
    bgEffect: "embers",
    avatarStyle: "crown-glow",
    titleEffect: "cyber-wave",
    orbStyle: "liquid",
    visualFx: {
      cardFloat: true,
      tilt3d: true,
      cursorGlow: true,
      scanlines: false,
      borderBeam: true,
    },
  },
  {
    id: "warp-arcade",
    name: "🚀 Warp Espacial",
    desc: "Estrellas en Hiperespacio + Pulso Sonar",
    accentColor: "#a855f7",
    secondaryColor: "#38bdf8",
    cardStyle: "arcade",
    bgEffect: "starfield",
    avatarStyle: "glitch-ring",
    titleEffect: "neon-pulse",
    orbStyle: "sonar",
    visualFx: {
      cardFloat: true,
      tilt3d: true,
      cursorGlow: true,
      scanlines: true,
      borderBeam: false,
    },
  },
  {
    id: "minimal-obsidian",
    name: "🌑 Obsidiana Minimal",
    desc: "Ultra elegante sin distracciones + Cristal",
    accentColor: "#f8fafc",
    secondaryColor: "#38bdf8",
    cardStyle: "minimal",
    bgEffect: "particles",
    avatarStyle: "crown-glow",
    titleEffect: "shimmer",
    orbStyle: "crystal",
    visualFx: {
      cardFloat: true,
      tilt3d: false,
      cursorGlow: true,
      scanlines: false,
      borderBeam: true,
    },
  },
];

export const DEFAULT_VISUAL_FX: VisualFxConfig = {
  cardFloat: false,
  tilt3d: true,
  cursorGlow: true,
  scanlines: true,
  borderBeam: true,
};

export const DEFAULT_PROFILE: ProfileData = {
  slug: "facxx14",
  user: "vynex7z",
  host: "Limacity",
  place: "Lima city",
  tz: "America/Lima",
  tagline: [
    "Habla Yo Te Dejo Ser.",
    "Mis redes y enlaces oficiales",
    "Conecta conmigo en un clic",
    "GG WP",
  ],
  role: "creator & gamer",
  vibe: "todas mis redes oficiales aquí",
  verified: true,
  avatar: "",
  accentColor: "#ff1a35",
  secondaryColor: "#ffffff",
  rainEnabled: true,
  cardStyle: "terminal",
  bgEffect: "matrix",
  avatarStyle: "orbit",
  titleEffect: "glitch",
  orbStyle: "halo",
  visualFx: { ...DEFAULT_VISUAL_FX },
  music: {
    enabled: true,
    source: "synth",
    preset: "lofi",
    url: "",
    dataUrl: "",
    title: "Lo-Fi Neon Rain",
    artist: "Red // Black System Beat",
    volume: 70,
  },
  links: [
    {
      id: "discord",
      name: "Discord",
      handle: "@vynex7z",
      url: "https://discord.com",
      badge: "ON",
    },
    {
      id: "instagram",
      name: "Instagram",
      handle: "@vynex7z",
      url: "https://www.instagram.com",
      badge: "",
    },
    {
      id: "tiktok",
      name: "TikTok",
      handle: "@vynex7z",
      url: "https://www.tiktok.com",
      badge: "HOT",
    },
    {
      id: "spotify",
      name: "Spotify",
      handle: "Playlist",
      url: "https://open.spotify.com",
      badge: "",
    },
    {
      id: "steam",
      name: "Steam",
      handle: "Perfil",
      url: "https://steamcommunity.com",
      badge: "",
    },
    {
      id: "youtube",
      name: "YouTube",
      handle: "Canal",
      url: "https://www.youtube.com",
      badge: "",
    },
  ],
  featuredLinks: [
    {
      id: "feat-1",
      icon: "discord",
      title: "Comunidad Oficial de Discord",
      subtitle: "Únete al servidor para charlar y jugar",
      url: "https://discord.com",
      badge: "DESTACADO",
    },
    {
      id: "feat-2",
      icon: "spotify",
      title: "Mi Playlist en Rotación",
      subtitle: "Beats oscuros, synthwave y phonk",
      url: "https://open.spotify.com",
      badge: "PLAYLIST",
    },
  ],
  copyTags: [
    {
      id: "copy-1",
      icon: "discord",
      label: "Discord User",
      value: "vynex7z",
    },
    {
      id: "copy-2",
      icon: "steam",
      label: "Steam / ID",
      value: "vynex7z",
    },
  ],
};

export const ICONS: Record<string, string> = {
  discord:
    '<path d="M7.5 6.5c3-1 6-1 9 0 1.6 2.6 2.5 5.3 2.8 8.5-1.4 1.1-3 1.8-4.6 2.2l-.9-1.5a9 9 0 0 1-3.6 0l-.9 1.5c-1.6-.4-3.2-1.1-4.6-2.2.3-3.2 1.2-5.9 2.8-8.5z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>',
  spotify:
    '<circle cx="12" cy="12" r="9"/><path d="M7 9.5c3.3-1 7-.7 10 1"/><path d="M7.5 12.7c2.7-.7 5.5-.5 8 .8"/><path d="M8 15.8c2.2-.5 4.2-.3 6 .6"/>',
  instagram:
    '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6"/>',
  steam:
    '<circle cx="12" cy="12" r="9"/><circle cx="15" cy="9.5" r="2.6"/><circle cx="8.8" cy="15" r="1.8"/><path d="M10.2 14 13 11.6"/>',
  tiktok: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>',
  twitch: '<path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7"/>',
  kick: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 8v8m0-4h2l3-4m-3 4 3 4"/>',
  youtube:
    '<rect x="3" y="6" width="18" height="12" rx="4"/><polygon points="10 9.5 15 12 10 14.5 10 9.5"/>',
  x: '<path d="M4 4l16 16M20 4L4 20"/>',
  whatsapp:
    '<path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.3L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5z"/>',
  telegram: '<path d="M21 4L3 11l6 2.5L18 7l-6.5 8.5 6 4.5L21 4z"/>',
  facebook:
    '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  github: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 6l-3 12"/>',
  riot: '<polygon points="12 3 3 8 6 19 10 19 9 11 11 11 12 19 15 19 14 10 16 10 17 19 20 19 21 8 12 3"/>',
  playstation: '<path d="M9 4v16m0-16 6 2.5v5L9 9m0 7-5 1.5L9 20m6-5.5 5 1.5-5 2"/>',
  xbox: '<circle cx="12" cy="12" r="9"/><path d="M7.5 6.5c3 2.5 6 5.5 9 11m0-11c-3 2.5-6 5.5-9 11"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
};

export function sanitizeSlug(raw: string | undefined | null): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^[/#?]+/, "")
    .replace(/[^a-z0-9_-]/g, "");
}

export function normalizeProfile(
  data: Partial<ProfileData> | undefined,
  fallbackSlug = "facxx14"
): ProfileData {
  const cleanSlug = sanitizeSlug(data?.slug || fallbackSlug) || "facxx14";
  const rainEnabled =
    data?.rainEnabled !== undefined ? Boolean(data.rainEnabled) : true;
  const bgEffect: BgEffect =
    data?.bgEffect || (rainEnabled ? "matrix" : "none");

  return {
    ...structuredClone(DEFAULT_PROFILE),
    ...data,
    slug: cleanSlug,
    verified: data?.verified !== undefined ? Boolean(data.verified) : true,
    accentColor: data?.accentColor || "#ff1a35",
    secondaryColor: data?.secondaryColor || "#ffffff",
    rainEnabled: bgEffect !== "none",
    cardStyle: data?.cardStyle || "terminal",
    bgEffect,
    avatarStyle: data?.avatarStyle || "orbit",
    titleEffect: data?.titleEffect || "glitch",
    orbStyle: data?.orbStyle || "halo",
    entryAnimation: data?.entryAnimation || "cyber-boot",
    introScreen: data?.introScreen || "none",
    introText: data?.introText || "[ CLICK PARA ENTRAR ]",
    visualFx: {
      ...DEFAULT_VISUAL_FX,
      ...(data?.visualFx || {}),
    },
    music: {
      ...structuredClone(DEFAULT_PROFILE.music),
      autoPlay: data?.music?.autoPlay !== undefined ? Boolean(data.music.autoPlay) : true,
      ...(data?.music || {}),
    },
    links: Array.isArray(data?.links)
      ? data!.links.map((l) => ({
          id: l.id || "web",
          name: l.name || l.id || "link",
          handle: l.handle || "",
          url: l.url || "https://",
          badge: l.badge || "",
        }))
      : structuredClone(DEFAULT_PROFILE.links),
    featuredLinks: Array.isArray(data?.featuredLinks)
      ? data!.featuredLinks
      : structuredClone(DEFAULT_PROFILE.featuredLinks),
    copyTags: Array.isArray(data?.copyTags)
      ? data!.copyTags
      : structuredClone(DEFAULT_PROFILE.copyTags),
    tagline:
      Array.isArray(data?.tagline) && data!.tagline.length > 0
        ? data!.tagline
        : structuredClone(DEFAULT_PROFILE.tagline),
    updatedAt: data?.updatedAt || new Date().toISOString(),
  };
}
