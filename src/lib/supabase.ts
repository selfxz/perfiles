import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  CopyTag,
  FeaturedRedirect,
  MusicConfig,
  normalizeProfile,
  ProfileData,
  ProfileLink,
  sanitizeSlug,
  VisualFxConfig,
} from "@/types/profile";

export interface SupabaseAdminConfigRow {
  id: number;
  password_hash: string | null;
  default_slug: string;
  updated_at?: string;
}

export interface SupabaseProfileRow {
  slug: string;
  user_name: string;
  host: string;
  place: string;
  tz: string;
  tagline: string[];
  role: string;
  vibe: string;
  verified: boolean;
  avatar: string;
  accent_color: string;
  secondary_color: string;
  rain_enabled: boolean;
  card_style: string;
  bg_effect: string;
  avatar_style: string;
  title_effect: string;
  orb_style: string;
  visual_fx: VisualFxConfig;
  music: MusicConfig;
  links: ProfileLink[];
  featured_links: FeaturedRedirect[];
  copy_tags: CopyTag[];
  raw_data?: Partial<ProfileData>;
  created_at?: string;
  updated_at?: string;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return {
    url: url.trim(),
    key: key.trim(),
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url.startsWith("http"));
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  const { url, key } = getSupabaseConfig();
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

export function profileToSupabaseRow(profile: ProfileData): SupabaseProfileRow {
  const cleanSlug = sanitizeSlug(profile.slug) || "facxx14";
  const normalized = normalizeProfile(profile, cleanSlug);
  return {
    slug: cleanSlug,
    user_name: normalized.user,
    host: normalized.host,
    place: normalized.place,
    tz: normalized.tz,
    tagline: normalized.tagline,
    role: normalized.role,
    vibe: normalized.vibe,
    verified: normalized.verified !== false,
    avatar: normalized.avatar || "",
    accent_color: normalized.accentColor || "#ff1a35",
    secondary_color: normalized.secondaryColor || "#ffffff",
    rain_enabled: normalized.rainEnabled !== false,
    card_style: normalized.cardStyle || "terminal",
    bg_effect: normalized.bgEffect || "matrix",
    avatar_style: normalized.avatarStyle || "orbit",
    title_effect: normalized.titleEffect || "glitch",
    orb_style: normalized.orbStyle || "halo",
    visual_fx: normalized.visualFx || {
      cardFloat: false,
      tilt3d: true,
      cursorGlow: false,
      scanlines: true,
      borderBeam: false,
    },
    music: normalized.music,
    links: normalized.links,
    featured_links: normalized.featuredLinks,
    copy_tags: normalized.copyTags,
    raw_data: normalized,
    updated_at: new Date().toISOString(),
  };
}

export function supabaseRowToProfile(row: SupabaseProfileRow): ProfileData {
  const slug = sanitizeSlug(row.slug) || "facxx14";
  const base: Partial<ProfileData> = {
    ...(row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {}),
    slug,
    user: row.user_name ?? row.raw_data?.user,
    host: row.host ?? row.raw_data?.host,
    place: row.place ?? row.raw_data?.place,
    tz: row.tz ?? row.raw_data?.tz,
    tagline: Array.isArray(row.tagline) ? row.tagline : row.raw_data?.tagline,
    role: row.role ?? row.raw_data?.role,
    vibe: row.vibe ?? row.raw_data?.vibe,
    verified:
      typeof row.verified === "boolean" ? row.verified : row.raw_data?.verified,
    avatar: row.avatar ?? row.raw_data?.avatar,
    accentColor: row.accent_color ?? row.raw_data?.accentColor,
    secondaryColor: row.secondary_color ?? row.raw_data?.secondaryColor,
    rainEnabled:
      typeof row.rain_enabled === "boolean"
        ? row.rain_enabled
        : row.raw_data?.rainEnabled,
    cardStyle: (row.card_style as ProfileData["cardStyle"]) ?? row.raw_data?.cardStyle,
    bgEffect: (row.bg_effect as ProfileData["bgEffect"]) ?? row.raw_data?.bgEffect,
    avatarStyle:
      (row.avatar_style as ProfileData["avatarStyle"]) ?? row.raw_data?.avatarStyle,
    titleEffect:
      (row.title_effect as ProfileData["titleEffect"]) ?? row.raw_data?.titleEffect,
    orbStyle: (row.orb_style as ProfileData["orbStyle"]) ?? row.raw_data?.orbStyle,
    visualFx: row.visual_fx ?? row.raw_data?.visualFx,
    music: row.music ?? row.raw_data?.music,
    links: Array.isArray(row.links) ? row.links : row.raw_data?.links,
    featuredLinks: Array.isArray(row.featured_links)
      ? row.featured_links
      : row.raw_data?.featuredLinks,
    copyTags: Array.isArray(row.copy_tags) ? row.copy_tags : row.raw_data?.copyTags,
    updatedAt: row.updated_at ?? row.raw_data?.updatedAt,
  };

  return normalizeProfile(base, slug);
}
