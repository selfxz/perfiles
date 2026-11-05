-- =============================================================================
-- NEXUS // STUDIO · ESQUEMA DE BASE DE DATOS PARA SUPABASE (PostgreSQL)
-- Copia y pega todo este script en el SQL Editor de tu proyecto en Supabase
-- y presiona "Run" para crear las tablas, índices, políticas RLS y el bucket.
-- =============================================================================

-- 1. TABLA DE CONFIGURACIÓN GLOBAL DE ADMINISTRADOR (1 sola fila global: id = 1)
CREATE TABLE IF NOT EXISTS public.admin_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text,
  default_slug text NOT NULL DEFAULT 'vynex7z',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABLA PRINCIPAL DE PERFILES Y RUTAS (/slug)
CREATE TABLE IF NOT EXISTS public.profiles (
  slug text PRIMARY KEY,
  user_name text NOT NULL DEFAULT 'vynex7z',
  host text NOT NULL DEFAULT 'terminal',
  place text NOT NULL DEFAULT 'Red // Local',
  tz text NOT NULL DEFAULT 'America/Lima',
  tagline jsonb NOT NULL DEFAULT '[]'::jsonb,
  role text NOT NULL DEFAULT 'creator & gamer',
  vibe text NOT NULL DEFAULT 'todas mis redes oficiales aquí',
  verified boolean NOT NULL DEFAULT true,
  avatar text NOT NULL DEFAULT '',
  accent_color text NOT NULL DEFAULT '#ff1a35',
  secondary_color text NOT NULL DEFAULT '#ffffff',
  rain_enabled boolean NOT NULL DEFAULT true,
  card_style text NOT NULL DEFAULT 'terminal',
  bg_effect text NOT NULL DEFAULT 'matrix',
  avatar_style text NOT NULL DEFAULT 'orbital',
  title_effect text NOT NULL DEFAULT 'glitch',
  orb_style text NOT NULL DEFAULT 'glass',
  visual_fx jsonb NOT NULL DEFAULT '{
    "cardFloat": true,
    "tilt3d": true,
    "cursorGlow": true,
    "scanlines": true,
    "borderBeam": false
  }'::jsonb,
  music jsonb NOT NULL DEFAULT '{
    "enabled": true,
    "source": "synth",
    "preset": "cyberpunk",
    "url": "",
    "dataUrl": "",
    "title": "Crimson Acid Drive",
    "artist": "Red // Black System Synth",
    "volume": 75
  }'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  copy_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsquedas rápidas y ordenamiento
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles (updated_at DESC);

-- Trigger automático para actualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_config_updated_at ON public.admin_config;
CREATE TRIGGER trg_admin_config_updated_at
BEFORE UPDATE ON public.admin_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. SEGURIDAD Y POLÍTICAS RLS (Row Level Security)
-- Permite que tu app Next.js lea y sincronice perfiles usando ANON_KEY o SERVICE_ROLE
-- =============================================================================
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "Studio write profiles" ON public.profiles;
CREATE POLICY "Studio write profiles"
  ON public.profiles FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Studio access admin_config" ON public.admin_config;
CREATE POLICY "Studio access admin_config"
  ON public.admin_config FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 4. BUCKET DE STORAGE PARA MÚSICA (MP3/OGG) Y AVATARES ("profile-assets")
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-assets', 'profile-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read profile-assets" ON storage.objects;
CREATE POLICY "Public read profile-assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-assets');

DROP POLICY IF EXISTS "Studio upload profile-assets" ON storage.objects;
CREATE POLICY "Studio upload profile-assets"
  ON storage.objects FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (bucket_id = 'profile-assets');

DROP POLICY IF EXISTS "Studio update profile-assets" ON storage.objects;
CREATE POLICY "Studio update profile-assets"
  ON storage.objects FOR UPDATE
  TO anon, authenticated, service_role
  USING (bucket_id = 'profile-assets');

DROP POLICY IF EXISTS "Studio delete profile-assets" ON storage.objects;
CREATE POLICY "Studio delete profile-assets"
  ON storage.objects FOR DELETE
  TO anon, authenticated, service_role
  USING (bucket_id = 'profile-assets');

-- =============================================================================
-- 5. DATOS INICIALES (SEED) DE TU CONFIGURACIÓN Y PERFIL ACTUAL (/vynex7z)
-- =============================================================================
INSERT INTO public.admin_config (id, password_hash, default_slug, updated_at)
VALUES (
  1,
  '37fee3d850c53ef49a4233076672f2073ab5fd0f8043ebea503e42077114d73b',
  'vynex7z',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  slug,
  user_name,
  host,
  place,
  tz,
  tagline,
  role,
  vibe,
  verified,
  accent_color,
  secondary_color,
  rain_enabled,
  card_style,
  bg_effect,
  avatar_style,
  title_effect,
  orb_style,
  visual_fx,
  music,
  links,
  featured_links,
  copy_tags
)
VALUES (
  'vynex7z',
  'vynex7z',
  'Limacity',
  'Lima city',
  'America/Lima',
  '["Habla Yo Te Dejo Ser.", "Mis redes y enlaces oficiales", "Conecta conmigo en un clic", "GG WP"]'::jsonb,
  'creator & gamer',
  'todas mis redes oficiales aquí',
  true,
  '#ff1a35',
  '#ffffff',
  true,
  'terminal',
  'particles',
  'hexagon',
  'shimmer',
  'halo',
  '{"cardFloat": false, "tilt3d": true, "cursorGlow": false, "scanlines": true, "borderBeam": false}'::jsonb,
  '{"enabled": true, "source": "synth", "preset": "lofi", "url": "", "dataUrl": "", "title": "Lo-Fi Neon Rain", "artist": "Red // Black System Beat", "volume": 70}'::jsonb,
  '[
    {"id": "discord", "name": "Discord", "handle": "@vynex7z", "url": "https://discord.com", "badge": "ON"},
    {"id": "instagram", "name": "Instagram", "handle": "@frxdy_obl", "url": "https://www.instagram.com/frxdy_obl", "badge": ""},
    {"id": "tiktok", "name": "TikTok", "handle": "@vynex7z", "url": "https://www.tiktok.com", "badge": "HOT"},
    {"id": "spotify", "name": "Spotify", "handle": "Playlist", "url": "https://open.spotify.com", "badge": ""},
    {"id": "steam", "name": "Steam", "handle": "Perfil", "url": "https://steamcommunity.com", "badge": ""},
    {"id": "youtube", "name": "YouTube", "handle": "Canal", "url": "https://www.youtube.com", "badge": ""}
  ]'::jsonb,
  '[
    {"id": "feat-1", "icon": "discord", "title": "Comunidad Oficial de Discord", "subtitle": "Únete al servidor para charlar y jugar", "url": "https://discord.com", "badge": "DESTACADO"},
    {"id": "feat-2", "icon": "spotify", "title": "Mi Playlist en Rotación", "subtitle": "Beats oscuros, synthwave y phonk", "url": "https://open.spotify.com", "badge": "PLAYLIST"}
  ]'::jsonb,
  '[
    {"id": "copy-1", "icon": "discord", "label": "Discord User", "value": "vynex7z"},
    {"id": "copy-2", "icon": "steam", "label": "Steam / ID", "value": "vynex7z"}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
