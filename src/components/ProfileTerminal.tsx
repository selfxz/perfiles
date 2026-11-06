"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import MatrixRain from "@/components/MatrixRain";
import {
  AvatarStyle,
  BgEffect,
  CardStyle,
  DEFAULT_PROFILE,
  DEFAULT_VISUAL_FX,
  FULL_STYLE_PRESETS,
  ICONS,
  MusicSource,
  normalizeProfile,
  OrbStyle,
  PRESET_NAMES,
  ProfileData,
  sanitizeSlug,
  SynthPreset,
  THEME_PRESETS,
  TitleEffect,
} from "@/types/profile";
import { detectAudioUrlType, musicEngine } from "@/utils/musicEngine";
import { downloadStaticProfileHtml } from "@/utils/exportHtml";

const STORAGE_PROFILES_KEY = "facxx14_profiles_v35";
const STORAGE_PASS_HASH_KEY = "facxx14_admin_hash_v35";
const SESSION_SYSTEM_LOCKED_KEY = "facxx14_system_locked_v35";

async function sha256Browser(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ProfileTerminalProps {
  mode?: "system" | "public";
  initialSlug?: string;
  initialDefaultSlug?: string;
  initialProfiles?: Record<string, ProfileData>;
  initialHasPassword?: boolean;
  initialCreateSlug?: string;
}

export default function ProfileTerminal({
  mode = "public",
  initialSlug = "facxx14",
  initialDefaultSlug = "facxx14",
  initialProfiles,
  initialHasPassword = false,
  initialCreateSlug = "",
}: ProfileTerminalProps) {
  const isSystemMode = mode === "system";

  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileData>>(() => {
    if (initialProfiles && Object.keys(initialProfiles).length > 0) {
      return initialProfiles;
    }
    return { facxx14: structuredClone(DEFAULT_PROFILE) };
  });

  const [defaultSlug, setDefaultSlug] = useState<string>(
    sanitizeSlug(initialDefaultSlug) || "facxx14"
  );

  const [activeSlug, setActiveSlug] = useState<string>(
    sanitizeSlug(initialSlug) || "facxx14"
  );

  const [me, setMe] = useState<ProfileData>(() => {
    const clean = sanitizeSlug(initialSlug) || "facxx14";
    return initialProfiles?.[clean]
      ? normalizeProfile(initialProfiles[clean], clean)
      : structuredClone(DEFAULT_PROFILE);
  });

  const [notFound, setNotFound] = useState<boolean>(() => {
    if (isSystemMode) return false;
    const clean = sanitizeSlug(initialSlug) || "facxx14";
    return initialProfiles ? !initialProfiles[clean] : false;
  });

  // Raw text buffer for editor multiline typewriter field
  const [taglineInput, setTaglineInput] = useState<string>(() =>
    (me.tagline || []).join("\n")
  );
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [copiedTagId, setCopiedTagId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);

  // System state (for `/` mode="system")
  const [hasMasterPassword, setHasMasterPassword] = useState<boolean>(initialHasPassword);
  const [isSystemLocked, setIsSystemLocked] = useState<boolean>(false);
  const [studioSection, setStudioSection] = useState<
    "routes" | "appearance" | "identity" | "links" | "audio" | "system"
  >("routes");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [syncState, setSyncState] = useState<"saved" | "saving">("saved");

  // Auth form state (when system is manually locked)
  const [authPass, setAuthPass] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authError, setAuthError] = useState("");

  // New Route creation & management state
  const [newRouteSlug, setNewRouteSlug] = useState(initialCreateSlug || "");
  const [newRouteNick, setNewRouteNick] = useState(initialCreateSlug || "");
  const [newRouteTemplate, setNewRouteTemplate] = useState<
    "default" | "current" | "clean"
  >("default");
  const [routeSearch, setRouteSearch] = useState("");
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  // Update Master Password state
  const [newMasterPass, setNewMasterPass] = useState("");

  // Music state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioUploadStatus, setAudioUploadStatus] = useState<string>(
    "Ningún archivo cargado"
  );

  // Typewriter, Clock, Uptime, Toast
  const [typedText, setTypedText] = useState<string>("");
  const [clockText, setClockText] = useState<string>("--:--:--");
  const [uptimeText, setUptimeText] = useState<string>("uptime 00:00:00");
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // File input refs
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const newRouteInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2600);
  }, []);

  // Subscribe to MusicEngine state
  useEffect(() => {
    return musicEngine.subscribe(({ isPlaying: p, isMuted: m, error }) => {
      setIsPlaying(p);
      setIsMuted(m);
      if (error) {
        showToast(error);
      }
    });
  }, [showToast]);

  const metaFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply dynamic per-profile accent colors and scanline toggle to CSS
  useEffect(() => {
    const color = me.accentColor || "#ff1a35";
    const secColor = me.secondaryColor || "#ffffff";
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--ok", color);
    document.documentElement.style.setProperty("--accent-2", secColor);
  }, [me.accentColor, me.secondaryColor]);

  useEffect(() => {
    const scanlinesOn = me.visualFx?.scanlines !== false;
    if (!scanlinesOn) {
      document.body.classList.add("no-scanlines");
    } else {
      document.body.classList.remove("no-scanlines");
    }
    return () => {
      document.body.classList.remove("no-scanlines");
    };
  }, [me.visualFx?.scanlines]);

  // Interactive cursor spotlight ref
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const winRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!me.visualFx?.cursorGlow) return;
    const onMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.left = `${e.clientX}px`;
        spotlightRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [me.visualFx?.cursorGlow]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!me.visualFx?.tilt3d || !winRef.current) return;
    const rect = winRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    winRef.current.style.transform = `perspective(950px) rotateX(${(
      -y * 6.5
    ).toFixed(2)}deg) rotateY(${(x * 6.5).toFixed(2)}deg)`;
  };

  const handleCardMouseLeave = () => {
    if (!winRef.current) return;
    winRef.current.style.transform = "";
  };

  // Topbar spacing in system mode
  useEffect(() => {
    if (isSystemMode) {
      document.body.classList.add("has-admin-bar");
    } else {
      document.body.classList.remove("has-admin-bar");
    }
    return () => {
      document.body.classList.remove("has-admin-bar");
    };
  }, [isSystemMode]);

  // Reset avatarError whenever avatar URL changes
  useEffect(() => {
    setAvatarError(false);
  }, [me.avatar]);

  // Load a profile into state (for editing/previewing in `/` or displaying in `/[slug]`)
  const applySlug = useCallback(
    (targetSlug: string, mapToUse: Record<string, ProfileData>) => {
      const available = Object.keys(mapToUse);
      const fallback = defaultSlug || available[0] || "facxx14";
      const clean = sanitizeSlug(targetSlug) || fallback;
      const routeChanged = clean !== activeSlug;
      setActiveSlug(clean);

      const found = mapToUse[clean];
      if (found) {
        const normalized = normalizeProfile(found, clean);
        setMe(normalized);
        setTaglineInput((normalized.tagline || []).join("\n"));
        setAvatarError(false);
        setNotFound(false);
        document.title = isSystemMode
          ? `NEXUS STUDIO (/) · Editando /${clean}`
          : `${normalized.user || clean} · /${clean}`;

        if (normalized.music.dataUrl || normalized.music.url) {
          setAudioUploadStatus("✓ Archivo de audio cargado en el perfil");
        } else {
          setAudioUploadStatus("Ningún archivo cargado");
        }

        if (!normalized.music.enabled) {
          musicEngine.stop();
        } else if (routeChanged && musicEngine.isPlaying()) {
          musicEngine.play(normalized.music);
        }
      } else if (isSystemMode && available.length > 0) {
        const firstSlug = available[0];
        const firstProfile = normalizeProfile(mapToUse[firstSlug], firstSlug);
        setActiveSlug(firstSlug);
        setMe(firstProfile);
        setTaglineInput((firstProfile.tagline || []).join("\n"));
        setNotFound(false);
      } else {
        musicEngine.stop();
        setNotFound(true);
        document.title = `404 · /${clean}`;
      }
    },
    [activeSlug, defaultSlug, isSystemMode]
  );

  // Hydrate from server API and localStorage on mount
  useEffect(() => {
    async function hydrateFromApi() {
      let mergedMap: Record<string, ProfileData> = { ...profilesMap };
      let currentDefSlug = defaultSlug;

      try {
        const localRaw = localStorage.getItem(STORAGE_PROFILES_KEY);
        if (localRaw) {
          const parsed = JSON.parse(localRaw) as Record<string, ProfileData>;
          mergedMap = { ...parsed, ...mergedMap };
        }
        const localPass = localStorage.getItem(STORAGE_PASS_HASH_KEY);
        if (localPass) {
          setHasMasterPassword(true);
        }
        if (
          isSystemMode &&
          sessionStorage.getItem(SESSION_SYSTEM_LOCKED_KEY) === "1"
        ) {
          setIsSystemLocked(true);
        }
      } catch {
        // ignore storage errors
      }

      try {
        const res = await fetch("/api/profiles", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.profiles && Object.keys(data.profiles).length > 0) {
            mergedMap = data.profiles;
            setProfilesMap(mergedMap);
            try {
              localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(mergedMap));
            } catch {
              // ignore quota
            }
          }
          if (data.defaultSlug) {
            currentDefSlug = data.defaultSlug;
            setDefaultSlug(data.defaultSlug);
          }
          if (typeof data.hasPassword === "boolean") {
            setHasMasterPassword(
              data.hasPassword || Boolean(localStorage.getItem(STORAGE_PASS_HASH_KEY))
            );
          }
        }
      } catch {
        // fallback to mergedMap
      }

      const target = sanitizeSlug(initialSlug) || currentDefSlug || "facxx14";
      applySlug(target, mergedMap);
    }

    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save profile to Server API + localStorage
  const saveProfileToServer = useCallback(
    async (
      slugToSave: string,
      profileData: ProfileData,
      silent = false
    ) => {
      const clean = sanitizeSlug(slugToSave) || "facxx14";
      const normalized = normalizeProfile(profileData, clean);
      setSyncState("saving");

      setProfilesMap((prev) => {
        const updatedMap = {
          ...prev,
          [clean]: normalized,
        };
        try {
          localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(updatedMap));
        } catch {
          // ignore localStorage quota errors
        }
        return updatedMap;
      });

      try {
        const res = await fetch(`/api/profiles/${clean}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: normalized }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profiles) {
            setProfilesMap(data.profiles);
          }
        }
      } catch (err) {
        console.warn("Guardado en modo local:", err);
      } finally {
        setSyncState("saved");
      }

      if (!silent) {
        showToast(`Perfil guardado y publicado en /${clean}`);
      }
    },
    [showToast]
  );

  // Select a profile inside the System (/) without leaving `/`
  const selectProfileInSystem = useCallback(
    (slug: string, mapOverride?: Record<string, ProfileData>) => {
      const clean = sanitizeSlug(slug) || defaultSlug || "facxx14";
      applySlug(clean, mapOverride || profilesMap);
    },
    [applySlug, defaultSlug, profilesMap]
  );

  // Typewriter effect
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lines =
      me.tagline && me.tagline.length > 0 ? me.tagline : ["GG WP"];

    if (reduce) {
      setTypedText(lines[0] || "GG WP");
      return;
    }

    let li = 0;
    let ci = 0;
    let del = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const currentLines =
        me.tagline && me.tagline.length > 0 ? me.tagline : ["GG WP"];
      if (li >= currentLines.length) li = 0;
      const line = currentLines[li] || "";

      if (!del) {
        ci++;
        if (ci >= line.length) {
          del = true;
          setTypedText(line);
          timer = setTimeout(tick, 2100);
          return;
        }
      } else {
        ci--;
        if (ci <= 0) {
          del = false;
          ci = 0;
          li = (li + 1) % currentLines.length;
        }
      }
      setTypedText(line.slice(0, ci));
      timer = setTimeout(tick, del ? 26 : 58);
    };

    timer = setTimeout(tick, 60);
    return () => clearTimeout(timer);
  }, [me.tagline]);

  // Live Clock & Uptime
  useEffect(() => {
    const t0 = Date.now();
    const pad = (n: number) => String(n).padStart(2, "0");

    const tickClock = () => {
      const d = new Date();
      let formatted = d.toTimeString().slice(0, 8);
      try {
        const fmt = new Intl.DateTimeFormat("es-PE", {
          timeZone: me.tz || "America/Lima",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        formatted = fmt.format(d);
      } catch {
        // fallback to local time string
      }
      setClockText(`${formatted} · UTC−5`);

      const s = Math.floor((Date.now() - t0) / 1000);
      setUptimeText(
        `uptime ${pad(Math.floor(s / 3600))}:${pad(
          Math.floor(s / 60) % 60
        )}:${pad(s % 60)}`
      );
    };

    tickClock();
    const interval = setInterval(tickClock, 1000);
    return () => clearInterval(interval);
  }, [me.tz]);

  // Update local preview state immediately AND schedule debounced autosave to server
  const updateMe = useCallback(
    (updater: (prev: ProfileData) => ProfileData) => {
      setMe((prev) => {
        const next = normalizeProfile(updater(prev), activeSlug);
        setProfilesMap((mapPrev) => ({
          ...mapPrev,
          [activeSlug]: next,
        }));

        if (isSystemMode) {
          setSyncState("saving");
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            saveProfileToServer(activeSlug, next, true);
          }, 550);
        }

        return next;
      });
    },
    [activeSlug, isSystemMode, saveProfileToServer]
  );

  const handleAudioUrlChange = useCallback(
    (rawInput: string, autoPlayNow = false) => {
      const trimmed = rawInput.trim();
      const detected = detectAudioUrlType(trimmed);

      updateMe((prev) => {
        const nextMusic = {
          ...prev.music,
          enabled: true,
          source: "url" as MusicSource,
          url: trimmed,
          title:
            prev.music.source !== "url" ||
            prev.music.title === PRESET_NAMES[prev.music.preset || "crimson"]
              ? detected.kind === "youtube"
                ? "YouTube Audio Track"
                : detected.kind === "soundcloud"
                ? "SoundCloud Track"
                : detected.kind === "spotify"
                ? "Spotify Track"
                : prev.music.title || "Audio Stream"
              : prev.music.title,
          artist:
            prev.music.source !== "url" ||
            prev.music.artist === "Red // Black System Beat"
              ? detected.label
              : prev.music.artist,
        };
        if ((autoPlayNow || musicEngine.isPlaying()) && trimmed) {
          setTimeout(() => musicEngine.play(nextMusic), 60);
        }
        return { ...prev, music: nextMusic };
      });

      if (metaFetchTimerRef.current) clearTimeout(metaFetchTimerRef.current);
      if (
        trimmed &&
        (detected.kind === "youtube" ||
          detected.kind === "soundcloud" ||
          detected.kind === "spotify")
      ) {
        metaFetchTimerRef.current = setTimeout(async () => {
          try {
            const res = await fetch(
              `/api/audio-proxy?meta=1&url=${encodeURIComponent(trimmed)}`
            );
            if (!res.ok) return;
            const data = await res.json();
            if (data.ok && (data.title || data.artist)) {
              updateMe((prev) => ({
                ...prev,
                music: {
                  ...prev.music,
                  title: data.title || prev.music.title,
                  artist: data.artist || detected.label,
                },
              }));
            }
          } catch {
            // ignore metadata error
          }
        }, 350);
      }
    },
    [updateMe]
  );

  // Delete profile from Server API + localStorage
  const deleteProfileFromServer = async (slugToDelete: string) => {
    const clean = sanitizeSlug(slugToDelete);
    const allKeys = Object.keys(profilesMap);
    if (allKeys.length <= 1) {
      showToast("Debe existir al menos un perfil activo en el sistema");
      return;
    }

    const updatedMap = { ...profilesMap };
    delete updatedMap[clean];
    setProfilesMap(updatedMap);

    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(updatedMap));
    } catch {
      // ignore
    }

    try {
      await fetch(`/api/profiles/${clean}`, { method: "DELETE" });
    } catch (err) {
      console.warn("Error eliminando perfil en servidor:", err);
    }

    const remainingSlugs = Object.keys(updatedMap);
    const nextFallback = remainingSlugs[0] || "facxx14";
    if (defaultSlug === clean) {
      setDefaultSlug(nextFallback);
    }

    showToast(`Ruta /${clean} eliminada`);
    if (activeSlug === clean) {
      selectProfileInSystem(nextFallback, updatedMap);
    }
  };

  // Rename an existing route (/oldSlug -> /newSlug)
  const handleRenameRoute = async (oldSlug: string, targetNewSlug: string) => {
    const cleanOld = sanitizeSlug(oldSlug);
    const cleanNew = sanitizeSlug(targetNewSlug);

    if (
      !cleanNew ||
      cleanNew === "admin" ||
      cleanNew === "studio" ||
      cleanNew === "sistema" ||
      cleanNew === "api"
    ) {
      showToast("Escribe un nombre de ruta válido (ej. ejemplo)");
      return;
    }
    if (cleanNew === cleanOld) {
      setRenamingSlug(null);
      return;
    }
    if (profilesMap[cleanNew]) {
      showToast(`La ruta /${cleanNew} ya existe`);
      return;
    }

    const existing = profilesMap[cleanOld] || me;
    const moved = normalizeProfile({ ...existing, slug: cleanNew }, cleanNew);
    const updatedMap = { ...profilesMap, [cleanNew]: moved };
    delete updatedMap[cleanOld];
    setProfilesMap(updatedMap);

    if (defaultSlug === cleanOld) {
      setDefaultSlug(cleanNew);
    }

    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(updatedMap));
    } catch {}

    try {
      const res = await fetch(`/api/profiles/${cleanOld}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlug: cleanNew }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profiles) setProfilesMap(data.profiles);
        if (data.defaultSlug) setDefaultSlug(data.defaultSlug);
      }
    } catch (err) {
      console.warn("Rename route offline fallback:", err);
    }

    setRenamingSlug(null);
    setRenameValue("");
    if (activeSlug === cleanOld) {
      selectProfileInSystem(cleanNew, updatedMap);
    }
    showToast(`Ruta actualizada: /${cleanOld} → /${cleanNew}`);
  };

  // Duplicate an existing profile into a new route
  const handleDuplicateRoute = async (sourceSlug: string) => {
    const source = profilesMap[sourceSlug];
    if (!source) return;
    let counter = 2;
    let candidate = `${sourceSlug}-${counter}`;
    while (profilesMap[candidate]) {
      counter++;
      candidate = `${sourceSlug}-${counter}`;
    }

    const cloned = normalizeProfile(
      {
        ...structuredClone(source),
        slug: candidate,
        user: `${source.user}_${counter}`,
      },
      candidate
    );

    await saveProfileToServer(candidate, cloned, true);
    const updatedMap = { ...profilesMap, [candidate]: cloned };
    selectProfileInSystem(candidate, updatedMap);
    setStudioSection("appearance");
    showToast(`Perfil clonado en la nueva ruta /${candidate}`);
  };

  // Handle Unlock System when locked
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPass.length < 4) {
      setAuthError("La clave debe tener al menos 4 caracteres.");
      return;
    }

    if (!hasMasterPassword && authPass !== authConfirm) {
      setAuthError("Las claves no coinciden.");
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: hasMasterPassword ? "verify" : "setup",
          password: authPass,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const localHash = localStorage.getItem(STORAGE_PASS_HASH_KEY);
        const inputHash = await sha256Browser(authPass);
        if (localHash && localHash === inputHash) {
          try {
            sessionStorage.removeItem(SESSION_SYSTEM_LOCKED_KEY);
          } catch {}
          setIsSystemLocked(false);
          setAuthPass("");
          showToast("Sistema Interno desbloqueado");
          return;
        }
        setAuthError(data.error || "Acceso denegado: Clave Maestra incorrecta.");
        return;
      }

      const hash = await sha256Browser(authPass);
      try {
        localStorage.setItem(STORAGE_PASS_HASH_KEY, hash);
        sessionStorage.removeItem(SESSION_SYSTEM_LOCKED_KEY);
      } catch {}

      setHasMasterPassword(true);
      setIsSystemLocked(false);
      setAuthPass("");
      showToast("Sistema Interno desbloqueado");
    } catch {
      const inputHash = await sha256Browser(authPass);
      const localHash = localStorage.getItem(STORAGE_PASS_HASH_KEY);
      if (!localHash || localHash === inputHash) {
        try {
          sessionStorage.removeItem(SESSION_SYSTEM_LOCKED_KEY);
        } catch {}
        setIsSystemLocked(false);
        setAuthPass("");
        showToast("Sistema Interno desbloqueado");
      } else {
        setAuthError("Acceso denegado: Clave Maestra incorrecta.");
      }
    }
  };

  // Copy shareable route URL (always `/slug`)
  const getShareableUrl = (slug: string) => {
    const clean = sanitizeSlug(slug) || "facxx14";
    if (typeof window === "undefined") return `/${clean}`;
    return `${window.location.origin}/${clean}`;
  };

  const copyText = async (text: string, msg = "Copiado al portapapeles") => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast(msg);
    }
  };

  // Create new profile and generate its dedicated route `/ejemplo`
  const handleCreateNewRoute = async (overrideSlug?: string) => {
    const rawSlug = overrideSlug || newRouteSlug || newRouteNick;
    const cleanSlug = sanitizeSlug(rawSlug);
    if (
      !cleanSlug ||
      cleanSlug === "admin" ||
      cleanSlug === "studio" ||
      cleanSlug === "sistema" ||
      cleanSlug === "api"
    ) {
      showToast("Escribe un nombre de ruta válido (ej. ejemplo)");
      newRouteInputRef.current?.focus();
      return;
    }
    if (profilesMap[cleanSlug]) {
      showToast(`La ruta /${cleanSlug} ya existe. Cargándola en el editor...`);
      selectProfileInSystem(cleanSlug);
      setStudioSection("appearance");
      return;
    }

    const displayUser = newRouteNick.trim() || cleanSlug;

    let baseProfile: ProfileData;
    if (newRouteTemplate === "current") {
      baseProfile = structuredClone(me);
    } else if (newRouteTemplate === "clean") {
      baseProfile = {
        ...structuredClone(DEFAULT_PROFILE),
        tagline: ["Mis redes oficiales", "Conecta conmigo en un clic"],
        role: "creator",
        vibe: "enlaces oficiales",
        verified: true,
        links: [
          {
            id: "instagram",
            name: "Instagram",
            handle: `@${displayUser}`,
            url: "https://www.instagram.com",
            badge: "ON",
          },
          {
            id: "tiktok",
            name: "TikTok",
            handle: `@${displayUser}`,
            url: "https://www.tiktok.com",
            badge: "",
          },
          {
            id: "discord",
            name: "Discord",
            handle: `@${displayUser}`,
            url: "https://discord.com",
            badge: "",
          },
        ],
        featuredLinks: [
          {
            id: `feat-${Date.now()}`,
            icon: "discord",
            title: "Mi Comunidad Oficial",
            subtitle: "Entra directo desde aquí",
            url: "https://discord.com",
            badge: "DESTACADO",
          },
        ],
        copyTags: [
          {
            id: `copy-${Date.now()}`,
            icon: "discord",
            label: "Discord ID",
            value: displayUser,
          },
        ],
      };
    } else {
      baseProfile = structuredClone(DEFAULT_PROFILE);
    }

    baseProfile.slug = cleanSlug;
    baseProfile.user = displayUser;

    await saveProfileToServer(cleanSlug, baseProfile, true);
    const updatedMap = { ...profilesMap, [cleanSlug]: baseProfile };

    setNewRouteSlug("");
    setNewRouteNick("");
    setActiveSlug(cleanSlug);
    setMe(baseProfile);
    setTaglineInput((baseProfile.tagline || []).join("\n"));
    setAvatarError(false);
    setNotFound(false);
    setProfilesMap(updatedMap);
    setStudioSection("appearance");
    showToast(`¡Perfil creado! Ruta pública disponible en /${cleanSlug}`);
  };

  // Handle Avatar Upload (with 260x260 center crop)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 260;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        updateMe((prev) => ({ ...prev, avatar: dataUrl }));
        showToast("Foto actualizada y guardada en el perfil");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(f);
  };

  // Handle Audio File Upload (uploads to /api/upload so large MP3s work reliably)
  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setAudioUploadStatus(`Subiendo ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", activeSlug);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const nextMusic = {
          ...me.music,
          source: "upload" as MusicSource,
          dataUrl: data.url,
          title: cleanName,
          artist: "Audio Propio",
        };
        updateMe((prev) => ({
          ...prev,
          music: nextMusic,
        }));
        setAudioUploadStatus(`✓ Cargado: ${file.name}`);
        musicEngine.play(nextMusic);
        showToast("Canción cargada y reproduciendo");
        return;
      }
    } catch {
      // Fallback to FileReader DataURL
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const nextMusic = {
        ...me.music,
        source: "upload" as MusicSource,
        dataUrl,
        title: cleanName,
        artist: "Audio Propio",
      };
      updateMe((prev) => ({
        ...prev,
        music: nextMusic,
      }));
      setAudioUploadStatus(`✓ Cargado: ${file.name}`);
      musicEngine.play(nextMusic);
      showToast("Canción cargada y reproduciendo");
    };
    reader.readAsDataURL(file);
  };

  // Export all profiles & routes as a JSON backup
  const handleExportAllJson = () => {
    const payload = {
      version: "4.0-nexus-studio",
      exportedAt: new Date().toISOString(),
      defaultSlug,
      profiles: profilesMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perfiles-rutas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Respaldo completo (.json) descargado");
  };

  // Import profiles & routes from a JSON backup
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const incomingProfiles = parsed.profiles || parsed;
        if (!incomingProfiles || typeof incomingProfiles !== "object") {
          showToast("Archivo JSON no válido");
          return;
        }
        const res = await fetch("/api/profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profiles: incomingProfiles,
            defaultSlug: parsed.defaultSlug || defaultSlug,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profiles) {
            setProfilesMap(data.profiles);
            try {
              localStorage.setItem(
                STORAGE_PROFILES_KEY,
                JSON.stringify(data.profiles)
              );
            } catch {}
            applySlug(activeSlug, data.profiles);
          }
          if (data.defaultSlug) setDefaultSlug(data.defaultSlug);
          showToast("Perfiles y rutas importados correctamente");
        }
      } catch {
        showToast("Error al leer el archivo JSON");
      }
    };
    reader.readAsText(file);
  };

  // Update Master Password
  const handleUpdateMasterPass = async () => {
    if (newMasterPass.length < 4) {
      showToast("La nueva clave debe tener al menos 4 caracteres");
      return;
    }
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", newPassword: newMasterPass }),
      });
      const hash = await sha256Browser(newMasterPass);
      localStorage.setItem(STORAGE_PASS_HASH_KEY, hash);
      setHasMasterPassword(true);
      setNewMasterPass("");
      showToast("Clave Maestra actualizada con éxito");
    } catch {
      showToast("Error al actualizar la clave");
    }
  };

  const moveItem = <T,>(arr: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  const initials = (me.user || "fx").slice(0, 2).toLowerCase();
  const sortedSlugs = Object.keys(profilesMap).sort();
  const filteredSlugs = sortedSlugs.filter((slug) => {
    if (!routeSearch.trim()) return true;
    const q = routeSearch.toLowerCase();
    const p = profilesMap[slug];
    return (
      slug.toLowerCase().includes(q) ||
      (p?.user || "").toLowerCase().includes(q) ||
      (p?.role || "").toLowerCase().includes(q)
    );
  });

  const previewNewSlug = sanitizeSlug(newRouteSlug || newRouteNick) || "ejemplo";
  const currentShareUrl = getShareableUrl(activeSlug);
  const totalRedirectsCount =
    (me.links || []).length +
    (me.featuredLinks || []).length +
    (me.copyTags || []).length;

  // Reusable Terminal Card (rendered standalone in `/[slug]`, or as Live Preview on the right side of `/`)
  const winClasses = [
    "win",
    `card-${me.cardStyle || "terminal"}`,
    me.visualFx?.cardFloat ? "fx-float" : "",
    me.visualFx?.borderBeam ? "fx-border-beam" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const titleClass =
    !me.titleEffect || me.titleEffect === "glitch"
      ? "glitch"
      : `hero-name title-${me.titleEffect}`;

  const renderTerminalCard = () => (
    <main
      ref={winRef}
      className={winClasses}
      onMouseMove={handleCardMouseMove}
      onMouseLeave={handleCardMouseLeave}
    >
      <header className="bar">
        <div className="dots" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div className="ttl" id="ttl">
          {notFound
            ? `guest@redos: /${activeSlug}`
            : `${me.user}@${me.host}: ~`}
        </div>
        <span className="route-pill" id="routeBadge">
          /{activeSlug}
        </span>
        <div className="sh" aria-hidden="true">
          gg
        </div>
      </header>

      {!notFound ? (
        <div id="profileContent">
          {/* CABECERA / HÉROE DEL PERFIL */}
          <section className="hero">
            <div
              className={`avatar av-${me.avatarStyle || "orbit"}`}
              id="avatar"
            >
              <span className="ring"></span>
              <span className="face" id="face">
                {me.avatar && !avatarError ? (
                  <img
                    src={me.avatar}
                    alt={me.user}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  initials
                )}
              </span>
            </div>

            <div className="hero-title-row">
              <h1 className={titleClass} id="name" data-text={me.user}>
                {me.user}
              </h1>
              {me.verified !== false && (
                <span className="verified-badge" title="Perfil Oficial Verificado">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </div>

            <p className="tag">
              <span id="tag">{typedText}</span>
              <span className="caret" aria-hidden="true"></span>
            </p>

            {(me.role || me.vibe) && (
              <div className="hero-vibe-pill">
                {me.role && <strong>{me.role}</strong>}
                {me.role && me.vibe && <span>·</span>}
                {me.vibe && <span>{me.vibe}</span>}
              </div>
            )}

            <ul className="meta">
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.500C19 14.800 12 21 12 21z" />
                  <circle cx="12" cy="9.500" r="2.500" />
                </svg>
                <span id="place">{me.place}</span>
              </li>
              <li>
                <span className="live" aria-hidden="true"></span>
                <span id="clock">{clockText}</span>
              </li>
              <li>
                <button
                  type="button"
                  className="share-orb-btn"
                  onClick={() => setShareModalOpen(true)}
                  title="Compartir enlace o código QR de este perfil"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Compartir
                </button>
              </li>
            </ul>
          </section>

          {/* NODOS CIRCULARES DE REDIRECCIÓN (ENLACES PRINCIPALES) */}
          {(me.links || []).length > 0 && (
            <section>
              <h2 className="lbl">
                <span>redes &amp; redirecciones</span>
              </h2>
              <ul
                className={`circular-links-grid orbs-${me.orbStyle || "halo"}`}
                id="links"
              >
                {(me.links || []).map((l, idx) => (
                  <li key={`${l.id}-${idx}`} className="orb-link-item">
                    <a
                      className="orb-link"
                      href={l.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="orb-circle-wrap">
                        <span className="orb-halo" aria-hidden="true"></span>
                        <span className="orb-circle">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{
                              __html: ICONS[l.id] || ICONS.web,
                            }}
                          />
                        </span>
                        {l.badge && <span className="orb-badge">{l.badge}</span>}
                      </div>
                      <div className="orb-label">
                        <span className="orb-name">{l.name}</span>
                        {l.handle && (
                          <span className="orb-handle">{l.handle}</span>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* TARJETAS DESTACADAS DE REDIRECCIÓN (CÁPSULAS CTA) */}
          {(me.featuredLinks || []).length > 0 && (
            <section>
              <h2 className="lbl">
                <span>accesos destacados</span>
              </h2>
              <ul className="featured-list">
                {(me.featuredLinks || []).map((f, idx) => (
                  <li key={f.id || idx}>
                    <a
                      className="featured-card"
                      href={f.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="featured-orb">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{
                            __html: ICONS[f.icon] || ICONS.web,
                          }}
                        />
                      </span>
                      <span className="featured-text">
                        <span className="featured-title-row">
                          <span className="featured-title">{f.title}</span>
                          {f.badge && (
                            <span className="featured-badge">{f.badge}</span>
                          )}
                        </span>
                        {f.subtitle && (
                          <span className="featured-sub">{f.subtitle}</span>
                        )}
                      </span>
                      <span className="featured-go-orb" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* COPIAR ID / TAGS EN 1 CLIC */}
          {(me.copyTags || []).length > 0 && (
            <section>
              <h2 className="lbl">
                <span>copiar id rápido</span>
              </h2>
              <div className="copy-tags-grid">
                {(me.copyTags || []).map((c, idx) => {
                  const isCopied = copiedTagId === (c.id || String(idx));
                  return (
                    <button
                      key={c.id || idx}
                      type="button"
                      className="copy-tag-pill"
                      onClick={() => {
                        copyText(
                          c.value,
                          `${c.label} copiado: ${c.value}`
                        );
                        setCopiedTagId(c.id || String(idx));
                        setTimeout(() => setCopiedTagId(null), 1600);
                      }}
                    >
                      <span className="copy-tag-orb">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{
                            __html: ICONS[c.icon] || ICONS.web,
                          }}
                        />
                      </span>
                      <span className="copy-tag-info">
                        <span className="copy-tag-label">{c.label}</span>
                        <span className="copy-tag-val">{c.value}</span>
                      </span>
                      <span className="copy-tag-action" aria-hidden="true">
                        {isCopied ? "✓" : "📋"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* REPRODUCTOR DE MÚSICA INTERNO DEL PERFIL */}
          {me.music?.enabled && (
            <section id="musicSection">
              <h2 className="lbl">
                <span>audio // bgm</span>
                {me.music.source === "url" && me.music.url && (
                  <small
                    style={{
                      fontSize: 10,
                      color: "var(--accent)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {detectAudioUrlType(me.music.url).label}
                  </small>
                )}
              </h2>

              {me.music.source === "url" &&
              detectAudioUrlType(me.music.url).kind === "spotify" &&
              detectAudioUrlType(me.music.url).spotifyEmbedUrl ? (
                <div style={{ borderRadius: 12, overflow: "hidden" }}>
                  <iframe
                    src={detectAudioUrlType(me.music.url).spotifyEmbedUrl}
                    width="100%"
                    height="80"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{
                      borderRadius: 12,
                      border: "1px solid var(--line-bright)",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`music-hud${isPlaying ? " playing" : ""}`}
                  id="musicHud"
                >
                  <button
                    type="button"
                    className="music-play-btn"
                    id="musicPlayBtn"
                    aria-label="Reproducir o pausar música"
                    onClick={() => musicEngine.toggle(me.music)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {isPlaying ? (
                        <>
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </>
                      ) : (
                        <polygon points="6 4 20 12 6 20 6 4" />
                      )}
                    </svg>
                  </button>
                  <div className="music-info">
                    <div className="music-title-row">
                      <div className="eq-bars" aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                      </div>
                      <span className="music-title" id="musicTitleDisplay">
                        {me.music.title || "Audio Track"}
                      </span>
                    </div>
                    <span className="music-artist" id="musicArtistDisplay">
                      {`${me.music.artist || "System Audio"} · ${
                        isPlaying ? "Reproduciendo" : "En pausa"
                      }`}
                    </span>
                  </div>
                  <div className="music-vol-wrap">
                    <button
                      type="button"
                      className="music-mute-btn"
                      id="musicMuteBtn"
                      aria-label="Silenciar"
                      onClick={() => musicEngine.toggleMute()}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        {isMuted || (me.music.volume ?? 70) === 0 ? (
                          <>
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <line x1="23" y1="9" x2="17" y2="15" />
                            <line x1="17" y1="9" x2="23" y2="15" />
                          </>
                        ) : (
                          <>
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          </>
                        )}
                      </svg>
                    </button>
                    <input
                      type="range"
                      className="music-vol-slider"
                      id="musicVolSlider"
                      min={0}
                      max={100}
                      value={me.music.volume ?? 70}
                      aria-label="Volumen"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateMe((prev) => ({
                          ...prev,
                          music: { ...prev.music, volume: v },
                        }));
                        musicEngine.setVolume(v, me.music);
                      }}
                    />
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        /* PANTALLA 404 CUANDO VISITAN UN /[slug] QUE AÚN NO EXISTE */
        <div id="notFoundContent" className="not-found-box">
          <div className="not-found-code">404</div>
          <h2
            style={{
              margin: 0,
              color: "var(--white)",
              fontFamily: "var(--display)",
            }}
          >
            RUTA /{activeSlug} NO ENCONTRADA
          </h2>
          <p id="notFoundMsg">
            El perfil en la ruta <code>/{activeSlug}</code> aún no ha sido creado en
            el Sistema Interno.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
              maxWidth: 280,
            }}
          >
            <a
              href={`/?create=${encodeURIComponent(activeSlug)}`}
              className="btn-primary"
              style={{ textDecoration: "none" }}
            >
              + Crear /{activeSlug} en el Sistema (/)
            </a>
            <a
              href="/"
              className="btn-sec"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              ← Ir al Sistema Interno (/)
            </a>
          </div>
        </div>
      )}

      <footer className="foot">
        <span id="up">{uptimeText}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>red//black v4.0</span>
        </div>
      </footer>
    </main>
  );

  return (
    <>
      <MatrixRain
        color={me.accentColor || "#ff1a35"}
        secondaryColor={me.secondaryColor || "#ffffff"}
        effect={me.bgEffect || (me.rainEnabled === false ? "none" : "matrix")}
        enabled={(me.bgEffect || "matrix") !== "none" && me.rainEnabled !== false}
      />

      {me.visualFx?.cursorGlow !== false && (
        <div ref={spotlightRef} className="cursor-spotlight" aria-hidden="true" />
      )}

      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleAvatarFileChange}
      />

      {/* ==========================================================================
          MODO 1: RUTA PÚBLICA DE PERFIL (/ejemplo, /facxx14, etc.)
          ========================================================================== */}
      {!isSystemMode && renderTerminalCard()}

      {/* ==========================================================================
          MODO 2: NEXUS STUDIO — SISTEMA INTERNO UI/UX EN LA RAÍZ (/)
          ========================================================================== */}
      {isSystemMode && (
        <>
          {/* CABECERA FLOTANTE DE COMANDO (COMMAND HEADER) */}
          <header className="studio-header" id="adminTopbar">
            <div className="studio-brand">
              <div className="studio-logo-orb" aria-hidden="true">
                NX
              </div>
              <div className="studio-brand-title">
                <strong>
                  NEXUS // STUDIO
                  <span className={`sync-pill ${syncState}`}>
                    {syncState === "saving" ? "⟳ Guardando" : "● Live Sync"}
                  </span>
                </strong>
                <span>Sistema Creador Multi-Ruta · Raíz (/)</span>
              </div>

              <div className="studio-divider" aria-hidden="true" />

              <div className="studio-route-switcher" title="Cambiar ruta activa en el editor">
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Ruta:</span>
                <select
                  id="adminQuickSwitch"
                  aria-label="Seleccionar perfil para editar"
                  value={activeSlug}
                  onChange={(e) => selectProfileInSystem(e.target.value)}
                >
                  {sortedSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      /{slug} — {profilesMap[slug]?.user || slug}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="studio-kpis">
              <span className="studio-kpi-pill">
                🌐 Rutas: <b>{sortedSlugs.length}</b>
              </span>
              <span className="studio-kpi-pill">
                🟢 Nodos: <b>{(me.links || []).length}</b>
              </span>
              <span className="studio-kpi-pill">
                ⭐ Destacados: <b>{(me.featuredLinks || []).length}</b>
              </span>
            </div>

            <div className="studio-header-actions">
              <button
                type="button"
                className="ux-btn"
                onClick={() => {
                  setStudioSection("routes");
                  setTimeout(() => newRouteInputRef.current?.focus(), 60);
                }}
              >
                + Nueva Ruta
              </button>
              <button
                type="button"
                className="ux-btn"
                onClick={() =>
                  copyText(
                    getShareableUrl(activeSlug),
                    `URL pública de /${activeSlug} copiada`
                  )
                }
              >
                🔗 Copiar URL
              </button>
              <button
                type="button"
                className="ux-btn"
                onClick={() => setShareModalOpen(true)}
                title="Código QR de la ruta activa"
              >
                📱 QR
              </button>
              <a
                href={`/${activeSlug}`}
                className="ux-btn primary"
                title={`Abrir ruta pública /${activeSlug}`}
              >
                ↗ Abrir /{activeSlug}
              </a>
              <button
                type="button"
                className="ux-btn"
                title="Bloquear pantalla del Estudio con Clave Maestra"
                onClick={() => {
                  try {
                    sessionStorage.setItem(SESSION_SYSTEM_LOCKED_KEY, "1");
                  } catch {}
                  setAuthError("");
                  setAuthPass("");
                  setIsSystemLocked(true);
                }}
              >
                🔒
              </button>
            </div>
          </header>

          {/* SHELL DE 3 COLUMNAS: SIDEBAR DE NAVEGACIÓN + INSPECTOR CENTRAL + ESCENARIO EN VIVO */}
          <div className="studio-grid">
            {/* COLUMNA 1: BARRA LATERAL DE NAVEGACIÓN (SIDEBAR RAIL) */}
            <aside className="studio-nav-rail" aria-label="Navegación del Estudio">
              <div className="studio-nav-box">
                <div className="studio-nav-label">
                  <span>Módulos de Diseño</span>
                  <span>/{activeSlug}</span>
                </div>
                <nav className="studio-nav-list">
                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "routes" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("routes")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">🌐</span>
                      <span>Rutas &amp; Perfiles</span>
                    </span>
                    <span className="studio-nav-badge">{sortedSlugs.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "appearance" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("appearance")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">🎨</span>
                      <span>Apariencia &amp; FX</span>
                    </span>
                    <span className="studio-nav-badge">
                      {me.cardStyle || "terminal"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "identity" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("identity")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">👤</span>
                      <span>Identidad &amp; Bio</span>
                    </span>
                    <span className="studio-nav-badge">
                      {me.verified !== false ? "✓" : "—"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "links" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("links")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">🔗</span>
                      <span>Enlaces &amp; IDs</span>
                    </span>
                    <span className="studio-nav-badge">{totalRedirectsCount}</span>
                  </button>

                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "audio" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("audio")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">🎵</span>
                      <span>Audio &amp; BGM</span>
                    </span>
                    <span className="studio-nav-badge">
                      {me.music?.enabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`studio-nav-item${
                      studioSection === "system" ? " active" : ""
                    }`}
                    onClick={() => setStudioSection("system")}
                  >
                    <span className="studio-nav-item-left">
                      <span className="studio-nav-icon">⚙️</span>
                      <span>Backup &amp; Clave</span>
                    </span>
                    <span className="studio-nav-badge">JSON</span>
                  </button>
                </nav>
              </div>

              {/* ACCESO RÁPIDO A TODAS LAS RUTAS DESDE EL SIDEBAR */}
              <div className="studio-nav-box">
                <div className="studio-nav-label">
                  <span>Mis Rutas Activas</span>
                  <span>{sortedSlugs.length}</span>
                </div>
                <div className="sidebar-route-list">
                  {sortedSlugs.map((slug) => {
                    const p = profilesMap[slug];
                    const isCur = slug === activeSlug;
                    return (
                      <div
                        key={slug}
                        className={`sidebar-route-pill${isCur ? " active" : ""}`}
                        onClick={() => selectProfileInSystem(slug)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span
                            className="sidebar-route-dot"
                            style={{
                              background: p?.accentColor || "#ff1a35",
                              boxShadow: `0 0 8px ${p?.accentColor || "#ff1a35"}`,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontWeight: isCur ? 700 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            /{slug}
                          </span>
                        </div>
                        <a
                          href={`/${slug}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: "var(--muted)",
                            textDecoration: "none",
                            fontSize: 11,
                            padding: "1px 5px",
                          }}
                          title={`Abrir /${slug}`}
                        >
                          ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="ux-btn primary"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() =>
                    saveProfileToServer(activeSlug, me)
                  }
                >
                  ☁ Guardar /{activeSlug}
                </button>
              </div>
            </aside>

            {/* COLUMNA 2: LIENZO CENTRAL DEL INSPECTOR (MAIN CANVAS) */}
            <section className="studio-main-canvas" aria-label="Editor del Perfil">
              {/* ================================================================
                  MÓDULO 1: RUTAS & PERFILES (GENERADOR /ejemplo + BENTO GRID)
                  ================================================================ */}
              {studioSection === "routes" && (
                <div className="studio-module-pane">
                  <div className="ux-card highlight">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🚀</div>
                        <div>
                          <h3>Crear Nuevo Perfil con Ruta Propia</h3>
                          <p>
                            Cada perfil que creas genera al instante una ruta pública
                            independiente (ej. <code>/ejemplo</code>,{" "}
                            <code>/vynex7z</code>, <code>/kaiser</code>).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-form-grid">
                      <div className="ux-field">
                        <label className="ux-label">
                          Identificador de la Ruta
                          <span>URL pública</span>
                        </label>
                        <div className="ux-url-input-group">
                          <span className="ux-url-prefix">/</span>
                          <input
                            ref={newRouteInputRef}
                            type="text"
                            placeholder="ejemplo"
                            value={newRouteSlug}
                            onChange={(e) => setNewRouteSlug(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateNewRoute();
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="ux-field">
                        <label className="ux-label">
                          Nick / Nombre del Perfil
                          <span>Título principal</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="Ejemplo"
                          value={newRouteNick}
                          onChange={(e) => {
                            setNewRouteNick(e.target.value);
                            if (!newRouteSlug) {
                              setNewRouteSlug(sanitizeSlug(e.target.value));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateNewRoute();
                            }
                          }}
                        />
                      </div>

                      <div className="ux-field full">
                        <label className="ux-label">
                          Plantilla Inicial
                          <span>Punto de partida</span>
                        </label>
                        <div className="ux-option-grid">
                          {(
                            [
                              {
                                id: "default",
                                title: "⚡ Plantilla Completa",
                                desc: "6 enlaces circulares, destacados, IDs y música",
                              },
                              {
                                id: "current",
                                title: `⧉ Clonar /${activeSlug}`,
                                desc: "Copia el estilo, efectos y enlaces del perfil activo",
                              },
                              {
                                id: "clean",
                                title: "✨ Minimal Limpio",
                                desc: "Estructura ligera con 3 redes básicas para empezar",
                              },
                            ] as const
                          ).map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              className={`ux-option-card${
                                newRouteTemplate === tpl.id ? " active" : ""
                              }`}
                              onClick={() => setNewRouteTemplate(tpl.id)}
                            >
                              <strong>{tpl.title}</strong>
                              <span>{tpl.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        paddingTop: 6,
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        Se publicará automáticamente en:{" "}
                        <code
                          style={{
                            color: "var(--white)",
                            background: "rgba(255,255,255,0.06)",
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          /{previewNewSlug}
                        </code>
                      </div>
                      <button
                        type="button"
                        className="ux-btn primary"
                        onClick={() => handleCreateNewRoute()}
                      >
                        + Crear Perfil en /{previewNewSlug}
                      </button>
                    </div>
                  </div>

                  {/* DIRECTORIO BENTO DE TODAS LAS RUTAS CREADAS */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🌐</div>
                        <div>
                          <h3>
                            Directorio de Rutas Públicas ({sortedSlugs.length})
                          </h3>
                          <p>
                            Selecciona cualquier perfil para editarlo en tiempo real
                            o abre su ruta pública.
                          </p>
                        </div>
                      </div>

                      {sortedSlugs.length > 2 && (
                        <input
                          type="text"
                          className="ux-input"
                          style={{ maxWidth: 230 }}
                          placeholder="🔍 Filtrar por ruta o nick..."
                          value={routeSearch}
                          onChange={(e) => setRouteSearch(e.target.value)}
                        />
                      )}
                    </div>

                    <div className="ux-routes-grid">
                      {filteredSlugs.map((slug) => {
                        const p = profilesMap[slug];
                        const isCurrent = slug === activeSlug;
                        const isRenaming = renamingSlug === slug;

                        return (
                          <div
                            key={slug}
                            className={`ux-route-bento${
                              isCurrent ? " current" : ""
                            }`}
                          >
                            <div className="ux-route-top">
                              <div
                                className="ux-route-avatar"
                                style={{
                                  borderColor: p?.accentColor || "var(--accent)",
                                  boxShadow: `0 0 14px ${
                                    p?.accentColor || "#ff1a35"
                                  }44`,
                                }}
                              >
                                {p?.avatar ? (
                                  <img src={p.avatar} alt={p.user} />
                                ) : (
                                  (p?.user || slug).slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <strong
                                    style={{
                                      fontSize: 14.5,
                                      color: "var(--white)",
                                    }}
                                  >
                                    {p?.user || slug}
                                  </strong>
                                  <a
                                    href={`/${slug}`}
                                    className="route-slug-link"
                                    title={`Abrir /${slug}`}
                                  >
                                    /{slug} ↗
                                  </a>
                                </div>
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: "var(--muted)",
                                    marginTop: 2,
                                  }}
                                >
                                  {p?.role || "creator"} · Estilo{" "}
                                  {p?.cardStyle || "terminal"}
                                </div>
                              </div>
                            </div>

                            <div className="ux-route-stats">
                              <span className="ux-stat-chip">
                                🟢 {(p?.links || []).length} redes
                              </span>
                              <span className="ux-stat-chip">
                                ⭐ {(p?.featuredLinks || []).length} destacados
                              </span>
                              <span className="ux-stat-chip">
                                📋 {(p?.copyTags || []).length} IDs
                              </span>
                            </div>

                            {isRenaming ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <input
                                  type="text"
                                  className="ux-input mono"
                                  placeholder="nueva-ruta"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleRenameRoute(slug, renameValue);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="ux-btn primary"
                                  onClick={() =>
                                    handleRenameRoute(slug, renameValue)
                                  }
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  onClick={() => setRenamingSlug(null)}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                  marginTop: "auto",
                                }}
                              >
                                <button
                                  type="button"
                                  className={`ux-btn${isCurrent ? " primary" : ""}`}
                                  style={{ flex: 1 }}
                                  onClick={() => {
                                    selectProfileInSystem(slug);
                                    setStudioSection("appearance");
                                  }}
                                >
                                  ✎ Personalizar
                                </button>
                                <a
                                  href={`/${slug}`}
                                  className="ux-btn"
                                  title={`Abrir ruta pública /${slug}`}
                                >
                                  ↗
                                </a>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  onClick={() =>
                                    copyText(
                                      getShareableUrl(slug),
                                      `Link de /${slug} copiado`
                                    )
                                  }
                                  title="Copiar link"
                                >
                                  🔗
                                </button>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  onClick={() => handleDuplicateRoute(slug)}
                                  title="Clonar en nueva ruta"
                                >
                                  ⧉
                                </button>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  onClick={() => {
                                    setRenamingSlug(slug);
                                    setRenameValue(slug);
                                  }}
                                  title="Cambiar URL de la ruta"
                                >
                                  ⇄
                                </button>
                                {sortedSlugs.length > 1 && (
                                  <button
                                    type="button"
                                    className="ux-btn danger"
                                    onClick={() => deleteProfileFromServer(slug)}
                                    title="Eliminar perfil"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  MÓDULO 2: APARIENCIA, ESTILOS VISUALES & EFECTOS FX
                  ================================================================ */}
              {studioSection === "appearance" && (
                <div className="studio-module-pane">
                  {/* GALERÍA DE PRESETS COMPLETOS EN 1 CLIC */}
                  <div className="ux-card highlight">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">⚡</div>
                        <div>
                          <h3>Temas Maestros en 1 Clic (/{activeSlug})</h3>
                          <p>
                            Aplica una combinación completa de arquitectura de
                            tarjeta, fondo animado, física de orbes y efectos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-option-grid">
                      {FULL_STYLE_PRESETS.map((preset) => {
                        const isPresetActive =
                          me.cardStyle === preset.cardStyle &&
                          me.bgEffect === preset.bgEffect &&
                          me.avatarStyle === preset.avatarStyle &&
                          me.orbStyle === preset.orbStyle;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`ux-option-card${
                              isPresetActive ? " active" : ""
                            }`}
                            onClick={() => {
                              updateMe((prev) => ({
                                ...prev,
                                accentColor: preset.accentColor,
                                secondaryColor: preset.secondaryColor,
                                cardStyle: preset.cardStyle,
                                bgEffect: preset.bgEffect,
                                rainEnabled: preset.bgEffect !== "none",
                                avatarStyle: preset.avatarStyle,
                                titleEffect: preset.titleEffect,
                                orbStyle: preset.orbStyle,
                                visualFx: { ...preset.visualFx },
                              }));
                              showToast(`Tema "${preset.name}" aplicado`);
                            }}
                          >
                            <strong>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  background: `linear-gradient(135deg, ${preset.accentColor}, ${preset.secondaryColor})`,
                                  display: "inline-block",
                                }}
                              />
                              {preset.name}
                            </strong>
                            <span>{preset.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PALETA DE COLOR DUAL */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🎨</div>
                        <div>
                          <h3>Paleta Dual de Color &amp; Gradientes Neón</h3>
                          <p>
                            Combina un color primario y uno secundario para los
                            aros cónicos, hologramas y destellos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="theme-swatches">
                      {THEME_PRESETS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`theme-swatch${
                            (me.accentColor || "#ff1a35").toLowerCase() ===
                            t.color.toLowerCase()
                              ? " active"
                              : ""
                          }`}
                          onClick={() =>
                            updateMe((prev) => ({
                              ...prev,
                              accentColor: t.color,
                              secondaryColor: t.secondary,
                            }))
                          }
                        >
                          <i
                            style={{
                              background: `linear-gradient(135deg, ${t.color}, ${t.secondary})`,
                            }}
                          />
                          {t.name}
                        </button>
                      ))}
                      <label
                        className="theme-swatch"
                        style={{ cursor: "pointer" }}
                        title="Color primario personalizado"
                      >
                        <input
                          type="color"
                          value={me.accentColor || "#ff1a35"}
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              accentColor: e.target.value,
                            }))
                          }
                          style={{
                            width: 18,
                            height: 18,
                            border: 0,
                            padding: 0,
                            background: "none",
                            cursor: "pointer",
                          }}
                        />
                        Primario
                      </label>
                      <label
                        className="theme-swatch"
                        style={{ cursor: "pointer" }}
                        title="Color secundario de contraste"
                      >
                        <input
                          type="color"
                          value={me.secondaryColor || "#ffffff"}
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              secondaryColor: e.target.value,
                            }))
                          }
                          style={{
                            width: 18,
                            height: 18,
                            border: 0,
                            padding: 0,
                            background: "none",
                            cursor: "pointer",
                          }}
                        />
                        Secundario
                      </label>
                    </div>
                  </div>

                  {/* ARQUITECTURA DE VENTANA + MOTOR DE FONDO */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🪟</div>
                        <div>
                          <h3>Estilo de Tarjeta &amp; Motor de Fondo</h3>
                          <p>
                            Elige la estructura física de la ventana y el escenario
                            animado en Canvas.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Estilo de la Ventana del Perfil
                        <span>cardStyle</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "terminal",
                              title: "💻 Cyber Terminal",
                              desc: "Barra de puntos + rejilla hacker",
                            },
                            {
                              id: "glass",
                              title: "🧊 Cristal Líquido",
                              desc: "Glassmorphism translúcido + reflejo",
                            },
                            {
                              id: "neon-cyber",
                              title: "⚡ Mecha HUD",
                              desc: "Esquinas biseladas + borde táctico",
                            },
                            {
                              id: "hologram",
                              title: "🌈 Holograma",
                              desc: "Barrido iridiscente espacial",
                            },
                            {
                              id: "minimal",
                              title: "🌑 Obsidiana Pro",
                              desc: "Curvas suaves sin barra superior",
                            },
                            {
                              id: "arcade",
                              title: "🕹️ Retro Arcade",
                              desc: "Doble marco pulsante synthwave",
                            },
                          ] as Array<{ id: CardStyle; title: string; desc: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.cardStyle || "terminal") === opt.id ? " active" : ""
                            }`}
                            onClick={() =>
                              updateMe((prev) => ({ ...prev, cardStyle: opt.id }))
                            }
                          >
                            <strong>{opt.title}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Escenario Animado de Fondo (Canvas 60fps)
                        <span>bgEffect</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "matrix",
                              title: "🟢 Lluvia Matrix",
                              desc: "Cascada de código japonés y binario",
                            },
                            {
                              id: "particles",
                              title: "🕸️ Constelación",
                              desc: "Nodos conectados por láser",
                            },
                            {
                              id: "embers",
                              title: "🔥 Brasas Neón",
                              desc: "Chispas y luces bokeh subiendo",
                            },
                            {
                              id: "starfield",
                              title: "🚀 Hiperespacio",
                              desc: "Viaje 3D entre estrellas warp",
                            },
                            {
                              id: "cybergrid",
                              title: "🌐 Horizonte 3D",
                              desc: "Rejilla en perspectiva synthwave",
                            },
                            {
                              id: "none",
                              title: "⬛ Fondo Limpio",
                              desc: "Sin animación en segundo plano",
                            },
                          ] as Array<{ id: BgEffect; title: string; desc: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.bgEffect || "matrix") === opt.id ? " active" : ""
                            }`}
                            onClick={() =>
                              updateMe((prev) => ({
                                ...prev,
                                bgEffect: opt.id,
                                rainEnabled: opt.id !== "none",
                              }))
                            }
                          >
                            <strong>{opt.title}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AURA DEL AVATAR, TEXTO Y FÍSICA DE ORBES CIRCULARES */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">✨</div>
                        <div>
                          <h3>Animaciones de Avatar, Título &amp; Enlaces Circulares</h3>
                          <p>
                            Personaliza el comportamiento cinético de los elementos
                            principales.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Marco y Aura del Avatar
                        <span>avatarStyle</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "orbit",
                              title: "🪐 Órbita Cónica",
                              desc: "Aro giratorio bicolor continuo",
                            },
                            {
                              id: "plasma",
                              title: "💥 Ondas Plasma",
                              desc: "Ondas expansivas concéntricas",
                            },
                            {
                              id: "hexagon",
                              title: "⬢ Hexágono Mecha",
                              desc: "Corte geométrico de 6 lados",
                            },
                            {
                              id: "glitch-ring",
                              title: "⚡ Anillo Eléctrico",
                              desc: "Segmentos con vibración cyber",
                            },
                            {
                              id: "crown-glow",
                              title: "👑 Halo Levitante",
                              desc: "Flotación suave + aura difusa",
                            },
                          ] as Array<{ id: AvatarStyle; title: string; desc: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.avatarStyle || "orbit") === opt.id ? " active" : ""
                            }`}
                            onClick={() =>
                              updateMe((prev) => ({ ...prev, avatarStyle: opt.id }))
                            }
                          >
                            <strong>{opt.title}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Efecto Tipográfico del Nick Principal
                        <span>titleEffect</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "glitch",
                              title: "👾 Glitch Cyber",
                              desc: "Cortes y desfase cromático",
                            },
                            {
                              id: "neon-pulse",
                              title: "💡 Tubo de Neón",
                              desc: "Resplandor con parpadeo orgánico",
                            },
                            {
                              id: "shimmer",
                              title: "🌊 Metal Líquido",
                              desc: "Gradiente fluido en movimiento",
                            },
                            {
                              id: "cyber-wave",
                              title: "🔮 Sombra 3D Laser",
                              desc: "Capas desplazadas + ondulación",
                            },
                            {
                              id: "clean",
                              title: "✨ Nítido Puro",
                              desc: "Blanco brillante sin distorsión",
                            },
                          ] as Array<{ id: TitleEffect; title: string; desc: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.titleEffect || "glitch") === opt.id ? " active" : ""
                            }`}
                            onClick={() =>
                              updateMe((prev) => ({ ...prev, titleEffect: opt.id }))
                            }
                          >
                            <strong>{opt.title}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Física de los Enlaces Circulares
                        <span>orbStyle</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "halo",
                              title: "⭕ Órbita Láser",
                              desc: "Anillo cónico al pasar el cursor",
                            },
                            {
                              id: "liquid",
                              title: "💧 Morfing Líquido",
                              desc: "Esferas orgánicas cambiantes",
                            },
                            {
                              id: "sonar",
                              title: "📡 Pulso Sonar",
                              desc: "Ondas de radar en cada icono",
                            },
                            {
                              id: "neon-ring",
                              title: "⚙️ Reactor Doble",
                              desc: "Anillo exterior punteado girando",
                            },
                            {
                              id: "crystal",
                              title: "🔮 Cristal 3D",
                              desc: "Esfera con brillo especular",
                            },
                          ] as Array<{ id: OrbStyle; title: string; desc: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.orbStyle || "halo") === opt.id ? " active" : ""
                            }`}
                            onClick={() =>
                              updateMe((prev) => ({ ...prev, orbStyle: opt.id }))
                            }
                          >
                            <strong>{opt.title}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* INTERRUPTORES DE INTERACTIVIDAD & FX */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🎛️</div>
                        <div>
                          <h3>Física 3D &amp; Efectos Especiales Interactivos</h3>
                          <p>
                            Activa o desactiva efectos de iluminación e interacción
                            con el cursor.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-toggle-grid">
                      {(
                        [
                          {
                            key: "tilt3d",
                            title: "📐 Inclinación 3D Parallax",
                            desc: "La tarjeta rota en 3D siguiendo el cursor",
                          },
                          {
                            key: "borderBeam",
                            title: "⚡ Rayo Láser Perimetral",
                            desc: "Un haz de luz recorre el borde de la ventana",
                          },
                          {
                            key: "cursorGlow",
                            title: "🔦 Spotlight de Cursor",
                            desc: "Luz ambiental neón que sigue el puntero",
                          },
                          {
                            key: "cardFloat",
                            title: "🛸 Levitación Flotante",
                            desc: "Movimiento respiratorio suave en el espacio",
                          },
                          {
                            key: "scanlines",
                            title: "📺 Scanlines de Monitor",
                            desc: "Textura sutil de líneas horizontales CRT",
                          },
                        ] as Array<{
                          key: keyof typeof DEFAULT_VISUAL_FX;
                          title: string;
                          desc: string;
                        }>
                      ).map((fx) => {
                        const currentFx = me.visualFx || DEFAULT_VISUAL_FX;
                        const isOn = Boolean(currentFx[fx.key]);
                        return (
                          <button
                            key={fx.key}
                            type="button"
                            className={`ux-toggle-card${isOn ? " active" : ""}`}
                            onClick={() =>
                              updateMe((prev) => {
                                const baseFx = prev.visualFx || DEFAULT_VISUAL_FX;
                                return {
                                  ...prev,
                                  visualFx: {
                                    ...baseFx,
                                    [fx.key]: !baseFx[fx.key],
                                  },
                                };
                              })
                            }
                          >
                            <div className="ux-toggle-info">
                              <strong>{fx.title}</strong>
                              <span>{fx.desc}</span>
                            </div>
                            <div className="ux-switch" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  MÓDULO 3: IDENTIDAD, AVATAR & BIOGRAFÍA
                  ================================================================ */}
              {studioSection === "identity" && (
                <div className="studio-module-pane">
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">👤</div>
                        <div>
                          <h3>Identidad &amp; Avatar de /{activeSlug}</h3>
                          <p>
                            Configura tu imagen de perfil, insignia de verificado y
                            datos principales.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* TARJETA INTERACTIVA DE AVATAR */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                        padding: 14,
                        borderRadius: 14,
                        background: "rgba(6, 6, 10, 0.65)",
                        border: "1px solid var(--studio-border)",
                      }}
                    >
                      <div
                        className="ux-route-avatar"
                        style={{
                          width: 64,
                          height: 64,
                          fontSize: 20,
                          borderColor: me.accentColor || "var(--accent)",
                          boxShadow: "0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)",
                        }}
                      >
                        {me.avatar && !avatarError ? (
                          <img src={me.avatar} alt={me.user} />
                        ) : (
                          initials.toUpperCase()
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 8,
                          }}
                        >
                          <button
                            type="button"
                            className="ux-btn primary"
                            onClick={() => avatarFileInputRef.current?.click()}
                          >
                            📁 Subir Foto (PC / Móvil)
                          </button>
                          {me.avatar && (
                            <button
                              type="button"
                              className="ux-btn danger"
                              onClick={() =>
                                updateMe((prev) => ({ ...prev, avatar: "" }))
                              }
                            >
                              Quitar Foto
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          className="ux-input mono"
                          placeholder="O pega una URL de imagen externa (https://...)"
                          value={
                            me.avatar && !me.avatar.startsWith("data:")
                              ? me.avatar
                              : ""
                          }
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              avatar: e.target.value.trim(),
                            }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        className={`ux-toggle-card${
                          me.verified !== false ? " active" : ""
                        }`}
                        style={{ minWidth: 210 }}
                        onClick={() =>
                          updateMe((prev) => ({
                            ...prev,
                            verified: prev.verified === false,
                          }))
                        }
                      >
                        <div className="ux-toggle-info">
                          <strong>Insignia Verificado ✓</strong>
                          <span>Check oficial junto al nick</span>
                        </div>
                        <div className="ux-switch" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="ux-form-grid">
                      <div className="ux-field">
                        <label className="ux-label">
                          Nick / Usuario Principal
                          <span>H1 Glitch</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="vynex7z"
                          value={me.user}
                          onChange={(e) =>
                            updateMe((prev) => ({ ...prev, user: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ux-field">
                        <label className="ux-label">
                          Host de Terminal
                          <span>Barra superior</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input mono"
                          placeholder="Limacity"
                          value={me.host}
                          onChange={(e) =>
                            updateMe((prev) => ({ ...prev, host: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ux-field">
                        <label className="ux-label">
                          Ubicación Visible
                          <span>Meta chip</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="Lima city"
                          value={me.place}
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              place: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="ux-field">
                        <label className="ux-label">
                          Rol / Categoría
                          <span>Etiqueta destacada</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="creator & gamer"
                          value={me.role}
                          onChange={(e) =>
                            updateMe((prev) => ({ ...prev, role: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ux-field full">
                        <label className="ux-label">
                          Bio Corta / Vibe
                          <span>Cápsula bajo el nombre</span>
                        </label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="todas mis redes oficiales aquí"
                          value={me.vibe}
                          onChange={(e) =>
                            updateMe((prev) => ({ ...prev, vibe: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ux-field full">
                        <label className="ux-label">
                          Frases de Máquina de Escribir (Typewriter)
                          <span>{(me.tagline || []).length} frases activas (1 por línea)</span>
                        </label>
                        <textarea
                          className="ux-textarea"
                          rows={4}
                          placeholder={"Habla Yo Te Dejo Ser.\nMis redes oficiales\nConecta conmigo en un clic"}
                          value={taglineInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setTaglineInput(raw);
                            updateMe((prev) => ({
                              ...prev,
                              tagline: raw
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  MÓDULO 4: ENLACES CIRCULARES, DESTACADOS & COPIAR IDs
                  ================================================================ */}
              {studioSection === "links" && (
                <div className="studio-module-pane">
                  {/* 1. ENLACES CIRCULARES */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🟢</div>
                        <div>
                          <h3>
                            Enlaces Circulares de Redirección (
                            {(me.links || []).length})
                          </h3>
                          <p>
                            Nodos orbitales con iconos vectoriales, insignias y
                            animaciones al pasar el cursor.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ux-btn primary"
                        onClick={() =>
                          updateMe((prev) => ({
                            ...prev,
                            links: [
                              ...(prev.links || []),
                              {
                                id: "instagram",
                                name: "Instagram",
                                handle: `@${prev.user || "usuario"}`,
                                url: "https://",
                                badge: "",
                              },
                            ],
                          }))
                        }
                      >
                        + Añadir Enlace Circular
                      </button>
                    </div>

                    <div className="dyn-list">
                      {(me.links || []).map((link, idx) => (
                        <div key={idx} className="ux-link-item-card">
                          <div className="ux-link-icon-preview">
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              dangerouslySetInnerHTML={{
                                __html: ICONS[link.id] || ICONS.web,
                              }}
                            />
                          </div>

                          <div className="ux-link-fields">
                            <div className="dyn-row" style={{ flexWrap: "wrap" }}>
                              <select
                                className="ux-select"
                                style={{ maxWidth: 145 }}
                                value={link.id}
                                onChange={(e) => {
                                  const newId = e.target.value;
                                  const iconKeys = Object.keys(ICONS);
                                  updateMe((prev) => {
                                    const nextLinks = [...prev.links];
                                    const cur = { ...nextLinks[idx], id: newId };
                                    if (
                                      !cur.name ||
                                      iconKeys.includes(cur.name.toLowerCase())
                                    ) {
                                      cur.name =
                                        newId.charAt(0).toUpperCase() +
                                        newId.slice(1);
                                    }
                                    nextLinks[idx] = cur;
                                    return { ...prev, links: nextLinks };
                                  });
                                }}
                              >
                                {Object.keys(ICONS).map((ico) => (
                                  <option key={ico} value={ico}>
                                    {ico.toUpperCase()}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="text"
                                className="ux-input"
                                style={{ flex: 1, minWidth: 120 }}
                                placeholder="Nombre (ej. Discord)"
                                value={link.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const nextLinks = [...prev.links];
                                    nextLinks[idx] = {
                                      ...nextLinks[idx],
                                      name: val,
                                    };
                                    return { ...prev, links: nextLinks };
                                  });
                                }}
                              />

                              <input
                                type="text"
                                className="ux-input mono"
                                style={{ maxWidth: 96 }}
                                placeholder="Badge (HOT)"
                                title="Insignia flotante (HOT, ON, LIVE)"
                                value={link.badge || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const nextLinks = [...prev.links];
                                    nextLinks[idx] = {
                                      ...nextLinks[idx],
                                      badge: val,
                                    };
                                    return { ...prev, links: nextLinks };
                                  });
                                }}
                              />

                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    updateMe((prev) => ({
                                      ...prev,
                                      links: moveItem(prev.links, idx, idx - 1),
                                    }))
                                  }
                                  title="Subir"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="ux-btn"
                                  disabled={idx === (me.links || []).length - 1}
                                  onClick={() =>
                                    updateMe((prev) => ({
                                      ...prev,
                                      links: moveItem(prev.links, idx, idx + 1),
                                    }))
                                  }
                                  title="Bajar"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="ux-btn danger"
                                  onClick={() =>
                                    updateMe((prev) => ({
                                      ...prev,
                                      links: prev.links.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  title="Eliminar enlace"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            <div className="dyn-row" style={{ flexWrap: "wrap" }}>
                              <input
                                type="text"
                                className="ux-input"
                                style={{ maxWidth: 180 }}
                                placeholder="@usuario o subtítulo"
                                value={link.handle}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const nextLinks = [...prev.links];
                                    nextLinks[idx] = {
                                      ...nextLinks[idx],
                                      handle: val,
                                    };
                                    return { ...prev, links: nextLinks };
                                  });
                                }}
                              />
                              <input
                                type="text"
                                className="ux-input mono"
                                style={{ flex: 1, minWidth: 180 }}
                                placeholder="https://..."
                                value={link.url}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const nextLinks = [...prev.links];
                                    nextLinks[idx] = {
                                      ...nextLinks[idx],
                                      url: val,
                                    };
                                    return { ...prev, links: nextLinks };
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. ACCESOS DESTACADOS / BANNERS CTA */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">⭐</div>
                        <div>
                          <h3>
                            Accesos Destacados / Cápsulas CTA (
                            {(me.featuredLinks || []).length})
                          </h3>
                          <p>
                            Tarjetas horizontales de alto impacto para comunidades,
                            servidores o playlists.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ux-btn primary"
                        onClick={() =>
                          updateMe((prev) => ({
                            ...prev,
                            featuredLinks: [
                              ...(prev.featuredLinks || []),
                              {
                                id: `feat-${Date.now()}`,
                                icon: "discord",
                                title: "Nuevo Acceso Destacado",
                                subtitle: "Descripción breve de redirección",
                                url: "https://",
                                badge: "OFICIAL",
                              },
                            ],
                          }))
                        }
                      >
                        + Añadir Destacado
                      </button>
                    </div>

                    <div className="dyn-list">
                      {(me.featuredLinks || []).map((feat, idx) => (
                        <div key={feat.id || idx} className="ux-link-item-card">
                          <div className="ux-link-icon-preview">
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              dangerouslySetInnerHTML={{
                                __html: ICONS[feat.icon] || ICONS.web,
                              }}
                            />
                          </div>

                          <div className="ux-link-fields">
                            <div className="dyn-row" style={{ flexWrap: "wrap" }}>
                              <select
                                className="ux-select"
                                style={{ maxWidth: 145 }}
                                value={feat.icon}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.featuredLinks || [])];
                                    next[idx] = { ...next[idx], icon: val };
                                    return { ...prev, featuredLinks: next };
                                  });
                                }}
                              >
                                {Object.keys(ICONS).map((ico) => (
                                  <option key={ico} value={ico}>
                                    {ico.toUpperCase()}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="text"
                                className="ux-input"
                                style={{ flex: 1, minWidth: 140 }}
                                placeholder="Título del banner"
                                value={feat.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.featuredLinks || [])];
                                    next[idx] = { ...next[idx], title: val };
                                    return { ...prev, featuredLinks: next };
                                  });
                                }}
                              />

                              <input
                                type="text"
                                className="ux-input mono"
                                style={{ maxWidth: 110 }}
                                placeholder="Badge (VIP)"
                                value={feat.badge || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.featuredLinks || [])];
                                    next[idx] = { ...next[idx], badge: val };
                                    return { ...prev, featuredLinks: next };
                                  });
                                }}
                              />

                              <button
                                type="button"
                                className="ux-btn danger"
                                onClick={() =>
                                  updateMe((prev) => ({
                                    ...prev,
                                    featuredLinks: (
                                      prev.featuredLinks || []
                                    ).filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                ✕
                              </button>
                            </div>

                            <div className="dyn-row" style={{ flexWrap: "wrap" }}>
                              <input
                                type="text"
                                className="ux-input"
                                style={{ flex: 1, minWidth: 160 }}
                                placeholder="Subtítulo descriptivo"
                                value={feat.subtitle}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.featuredLinks || [])];
                                    next[idx] = { ...next[idx], subtitle: val };
                                    return { ...prev, featuredLinks: next };
                                  });
                                }}
                              />
                              <input
                                type="text"
                                className="ux-input mono"
                                style={{ flex: 1, minWidth: 180 }}
                                placeholder="https://..."
                                value={feat.url}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.featuredLinks || [])];
                                    next[idx] = { ...next[idx], url: val };
                                    return { ...prev, featuredLinks: next };
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. COPIAR ID RÁPIDO EN 1 CLIC */}
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">📋</div>
                        <div>
                          <h3>
                            IDs &amp; Gamertags Copiables en 1 Clic (
                            {(me.copyTags || []).length})
                          </h3>
                          <p>
                            Tus seguidores copian tu usuario de Discord, Steam o
                            Riot con un solo toque.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ux-btn primary"
                        onClick={() =>
                          updateMe((prev) => ({
                            ...prev,
                            copyTags: [
                              ...(prev.copyTags || []),
                              {
                                id: `copy-${Date.now()}`,
                                icon: "discord",
                                label: "Discord ID",
                                value: prev.user || "usuario",
                              },
                            ],
                          }))
                        }
                      >
                        + Añadir ID Copiable
                      </button>
                    </div>

                    <div className="dyn-list">
                      {(me.copyTags || []).map((ct, idx) => (
                        <div key={ct.id || idx} className="ux-link-item-card">
                          <div className="ux-link-icon-preview">
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              dangerouslySetInnerHTML={{
                                __html: ICONS[ct.icon] || ICONS.web,
                              }}
                            />
                          </div>
                          <div className="ux-link-fields">
                            <div className="dyn-row" style={{ flexWrap: "wrap" }}>
                              <select
                                className="ux-select"
                                style={{ maxWidth: 145 }}
                                value={ct.icon}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.copyTags || [])];
                                    next[idx] = { ...next[idx], icon: val };
                                    return { ...prev, copyTags: next };
                                  });
                                }}
                              >
                                {Object.keys(ICONS).map((ico) => (
                                  <option key={ico} value={ico}>
                                    {ico.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="ux-input"
                                style={{ flex: 1, minWidth: 130 }}
                                placeholder="Etiqueta (ej. Discord ID)"
                                value={ct.label}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.copyTags || [])];
                                    next[idx] = { ...next[idx], label: val };
                                    return { ...prev, copyTags: next };
                                  });
                                }}
                              />
                              <input
                                type="text"
                                className="ux-input mono"
                                style={{ flex: 1, minWidth: 130 }}
                                placeholder="Valor a copiar (ej. vynex7z)"
                                value={ct.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMe((prev) => {
                                    const next = [...(prev.copyTags || [])];
                                    next[idx] = { ...next[idx], value: val };
                                    return { ...prev, copyTags: next };
                                  });
                                }}
                              />
                              <button
                                type="button"
                                className="ux-btn danger"
                                onClick={() =>
                                  updateMe((prev) => ({
                                    ...prev,
                                    copyTags: (prev.copyTags || []).filter(
                                      (_, i) => i !== idx
                                    ),
                                  }))
                                }
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  MÓDULO 5: AUDIO & SINTETIZADOR BGM
                  ================================================================ */}
              {studioSection === "audio" && (
                <div className="studio-module-pane">
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🎵</div>
                        <div>
                          <h3>Motor de Audio &amp; Música de Fondo</h3>
                          <p>
                            Configura beats sintetizados en tiempo real, sube un
                            MP3 propio o enlaza un stream directo.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`ux-toggle-card${
                          me.music?.enabled ? " active" : ""
                        }`}
                        onClick={() => {
                          const nextEnabled = !me.music?.enabled;
                          if (!nextEnabled) musicEngine.stop();
                          updateMe((prev) => ({
                            ...prev,
                            music: { ...prev.music, enabled: nextEnabled },
                          }));
                        }}
                      >
                        <div className="ux-toggle-info">
                          <strong>Reproductor en Perfil</strong>
                          <span>{me.music?.enabled ? "Visible" : "Oculto"}</span>
                        </div>
                        <div className="ux-switch" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="ux-field">
                      <label className="ux-label">
                        Fuente de Audio
                        <span>music.source</span>
                      </label>
                      <div className="ux-option-grid">
                        {(
                          [
                            {
                              id: "synth",
                              title: "🎹 Beats del Sistema",
                              desc: "Sintetizador WebAudio integrado",
                            },
                            {
                              id: "upload",
                              title: "📁 Subir MP3 Propio",
                              desc: "Sube una canción desde tu equipo",
                            },
                            {
                              id: "url",
                              title: "🌐 Link de Música",
                              desc: "YouTube, Spotify, SoundCloud o .mp3",
                            },
                          ] as Array<{
                            id: MusicSource;
                            title: string;
                            desc: string;
                          }>
                        ).map((srcOpt) => (
                          <button
                            key={srcOpt.id}
                            type="button"
                            className={`ux-option-card${
                              (me.music?.source || "synth") === srcOpt.id
                                ? " active"
                                : ""
                            }`}
                            onClick={() => {
                              updateMe((prev) => {
                                const preset = prev.music.preset || "crimson";
                                const nextMusic = {
                                  ...prev.music,
                                  source: srcOpt.id,
                                  title:
                                    srcOpt.id === "synth"
                                      ? PRESET_NAMES[preset]
                                      : prev.music.title,
                                  artist:
                                    srcOpt.id === "synth"
                                      ? "Red // Black System Beat"
                                      : prev.music.artist,
                                };
                                if (musicEngine.isPlaying()) {
                                  musicEngine.play(nextMusic);
                                }
                                return { ...prev, music: nextMusic };
                              });
                            }}
                          >
                            <strong>{srcOpt.title}</strong>
                            <span>{srcOpt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {me.music?.source === "synth" && (
                      <div className="ux-field">
                        <label className="ux-label">
                          Beat Sintetizado
                          <span>Selecciona el estilo musical</span>
                        </label>
                        <div className="ux-option-grid">
                          {(
                            [
                              {
                                id: "crimson",
                                title: "🔥 Cyber Crimson",
                                desc: "Synthwave oscuro arpegiado",
                              },
                              {
                                id: "phonk",
                                title: "🏎️ Night Drive Phonk",
                                desc: "Bajo 808 + cowbell drift",
                              },
                              {
                                id: "abyss",
                                title: "🌑 Dark Abyss Pulse",
                                desc: "Pulso cyberpunk industrial",
                              },
                              {
                                id: "lofi",
                                title: "🌧️ Lo-Fi Neon Rain",
                                desc: "Acordes chill nocturnos",
                              },
                            ] as Array<{
                              id: SynthPreset;
                              title: string;
                              desc: string;
                            }>
                          ).map((pOpt) => (
                            <button
                              key={pOpt.id}
                              type="button"
                              className={`ux-option-card${
                                (me.music?.preset || "crimson") === pOpt.id
                                  ? " active"
                                  : ""
                              }`}
                              onClick={() => {
                                updateMe((prev) => {
                                  const nextMusic = {
                                    ...prev.music,
                                    preset: pOpt.id,
                                    title: PRESET_NAMES[pOpt.id],
                                  };
                                  if (musicEngine.isPlaying()) {
                                    musicEngine.play(nextMusic);
                                  }
                                  return { ...prev, music: nextMusic };
                                });
                              }}
                            >
                              <strong>{pOpt.title}</strong>
                              <span>{pOpt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {me.music?.source === "upload" && (
                      <div className="ux-field">
                        <label className="ux-label">
                          Archivo de Audio Propio (.mp3, .ogg, .wav, .m4a)
                          <span>{audioUploadStatus}</span>
                        </label>
                        <div>
                          <button
                            type="button"
                            className="ux-btn primary"
                            onClick={() => audioFileInputRef.current?.click()}
                          >
                            🎵 Seleccionar Archivo de Audio desde PC/Celular
                          </button>
                          <input
                            ref={audioFileInputRef}
                            type="file"
                            accept="audio/*"
                            hidden
                            onChange={handleAudioFileChange}
                          />
                        </div>
                      </div>
                    )}

                    {me.music?.source === "url" && (
                      <div className="ux-field">
                        <label className="ux-label">
                          Link de la Canción (YouTube, Spotify, SoundCloud, Drive, Dropbox o .MP3)
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                            {me.music?.url
                              ? `✓ ${detectAudioUrlType(me.music.url).label}`
                              : "Pega cualquier enlace"}
                          </span>
                        </label>
                        <div className="dyn-row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            className="ux-input mono"
                            style={{ flex: 1, minWidth: 230 }}
                            placeholder="https://www.youtube.com/watch?v=... o link de Spotify / SoundCloud / .mp3"
                            value={me.music?.url || ""}
                            onChange={(e) =>
                              handleAudioUrlChange(e.target.value, false)
                            }
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData("text");
                              if (pasted) {
                                e.preventDefault();
                                handleAudioUrlChange(pasted, true);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="ux-btn primary"
                            onClick={() => {
                              if (!me.music?.url) {
                                showToast("Pega primero un enlace de música");
                                return;
                              }
                              if (isPlaying) {
                                musicEngine.pause();
                              } else {
                                musicEngine.play({
                                  ...me.music,
                                  enabled: true,
                                  source: "url",
                                });
                              }
                            }}
                          >
                            {isPlaying ? "⏸ Pausar" : "▶ Probar Link"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="ux-form-grid">
                      <div className="ux-field">
                        <label className="ux-label">Título de la Pista</label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="Lo-Fi Neon Rain"
                          value={me.music?.title || ""}
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              music: { ...prev.music, title: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="ux-field">
                        <label className="ux-label">Artista / Subtítulo</label>
                        <input
                          type="text"
                          className="ux-input"
                          placeholder="System Audio"
                          value={me.music?.artist || ""}
                          onChange={(e) =>
                            updateMe((prev) => ({
                              ...prev,
                              music: { ...prev.music, artist: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="ux-field full">
                        <label className="ux-label">
                          Volumen Predeterminado
                          <span>{me.music?.volume ?? 70}%</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={me.music?.volume ?? 70}
                          style={{ accentColor: "var(--accent)", width: "100%" }}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            musicEngine.setVolume(v, me.music);
                            updateMe((prev) => ({
                              ...prev,
                              music: { ...prev.music, volume: v },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================
                  MÓDULO 6: SISTEMA, RESPALDO JSON, HTML ESTÁTICO & CLAVE
                  ================================================================ */}
              {studioSection === "system" && (
                <div className="studio-module-pane">
                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">💾</div>
                        <div>
                          <h3>Copia de Seguridad Global (.JSON)</h3>
                          <p>
                            Exporta todos tus perfiles y rutas creadas en un único
                            archivo o restaura una copia anterior.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="ux-btn primary"
                        onClick={handleExportAllJson}
                      >
                        ⬇ Exportar Todas las Rutas (.json)
                      </button>
                      <button
                        type="button"
                        className="ux-btn"
                        onClick={() => importJsonInputRef.current?.click()}
                      >
                        ⬆ Importar Respaldo (.json)
                      </button>
                      <input
                        ref={importJsonInputRef}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={handleImportJsonFile}
                      />
                    </div>
                  </div>

                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">📦</div>
                        <div>
                          <h3>Exportar Perfil Individual Autónomo (.HTML)</h3>
                          <p>
                            Descarga un archivo <code>{me.slug}.html</code> listo
                            para abrir o subir en cualquier servidor estático.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="ux-btn"
                        onClick={() => {
                          downloadStaticProfileHtml(me);
                          showToast(`Archivo ${me.slug}.html descargado`);
                        }}
                      >
                        ⬇ Descargar {me.slug}.html
                      </button>
                    </div>
                  </div>

                  <div className="ux-card">
                    <div className="ux-card-head">
                      <div className="ux-card-title-group">
                        <div className="ux-card-icon">🔑</div>
                        <div>
                          <h3>Seguridad &amp; Clave Maestra del Estudio</h3>
                          <p>
                            Actualiza la clave usada cuando bloqueas la pantalla del
                            Estudio (<code>🔒</code>).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ux-form-grid">
                      <div className="ux-field">
                        <label className="ux-label">Nueva Clave Maestra</label>
                        <input
                          type="password"
                          className="ux-input"
                          placeholder="Mínimo 4 caracteres"
                          value={newMasterPass}
                          onChange={(e) => setNewMasterPass(e.target.value)}
                        />
                      </div>
                      <div
                        className="ux-field"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          type="button"
                          className="ux-btn primary"
                          style={{ height: 40 }}
                          onClick={handleUpdateMasterPass}
                        >
                          🔑 Guardar Nueva Clave
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* COLUMNA 3: ESCENARIO DE VISTA PREVIA EN VIVO (DEVICE STAGE) */}
            <aside className="studio-preview-stage" aria-label="Vista Previa en Tiempo Real">
              <div className="stage-browser-bar">
                <div className="dots" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>

                <button
                  type="button"
                  className="stage-url-pill"
                  onClick={() =>
                    copyText(
                      getShareableUrl(activeSlug),
                      `URL pública /${activeSlug} copiada`
                    )
                  }
                  title="Clic para copiar URL pública"
                >
                  <span>🔒</span>
                  <span>
                    ruta pública: <strong>/{activeSlug}</strong>
                  </span>
                </button>

                <div className="stage-device-toggle">
                  <button
                    type="button"
                    className={`stage-device-btn${
                      previewDevice === "desktop" ? " active" : ""
                    }`}
                    onClick={() => setPreviewDevice("desktop")}
                    title="Vista Desktop"
                  >
                    🖥️
                  </button>
                  <button
                    type="button"
                    className={`stage-device-btn${
                      previewDevice === "mobile" ? " active" : ""
                    }`}
                    onClick={() => setPreviewDevice("mobile")}
                    title="Simulación Móvil"
                  >
                    📱
                  </button>
                </div>
              </div>

              <div
                className={`stage-viewport-wrap${
                  previewDevice === "mobile" ? " mobile-frame" : ""
                }`}
              >
                {previewDevice === "mobile" && (
                  <div className="stage-mobile-notch" aria-hidden="true" />
                )}
                {renderTerminalCard()}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* MODAL PARA COMPARTIR PERFIL Y CÓDIGO QR */}
      <div
        className={`modal-overlay${shareModalOpen ? " open" : ""}`}
        aria-hidden={!shareModalOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShareModalOpen(false);
        }}
      >
        <div className="auth-card qr-box" role="dialog" aria-label="Compartir Perfil">
          <h3 style={{ justifyContent: "center", margin: 0 }}>
            🔗 Compartir /{activeSlug}
          </h3>
          <p style={{ margin: 0 }}>
            Escanea el código QR o copia el enlace directo a este perfil de
            redirecciones.
          </p>
          <div className="qr-frame">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                currentShareUrl
              )}`}
              alt={`QR /${activeSlug}`}
            />
          </div>
          <code
            style={{
              background: "#120c10",
              border: "1px solid var(--line-bright)",
              padding: "6px 12px",
              borderRadius: 999,
              color: "var(--white)",
              fontSize: 12,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentShareUrl}
          </code>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                copyText(currentShareUrl, `Link de /${activeSlug} copiado`);
                setShareModalOpen(false);
              }}
            >
              📋 Copiar Enlace
            </button>
            <button
              type="button"
              className="btn-sec"
              onClick={() => setShareModalOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE SEGURIDAD CUANDO EL SISTEMA INTERNO SE BLOQUEA MANUALMENTE */}
      {isSystemMode && (
        <div
          className={`modal-overlay${isSystemLocked ? " open" : ""}`}
          id="authModal"
          aria-hidden={!isSystemLocked}
        >
          <div className="auth-card" role="dialog" aria-labelledby="authTitle">
            <h3 id="authTitle">
              {hasMasterPassword
                ? "Sistema Interno Bloqueado"
                : "Configurar Clave Maestra"}
            </h3>
            <p id="authDesc">
              {hasMasterPassword
                ? "Introduce tu Clave Maestra para desbloquear el Sistema Interno (/)."
                : "Crea una Clave Maestra para proteger el Sistema Interno."}
            </p>
            <form onSubmit={handleAuthSubmit} autoComplete="off">
              <div className="ed-field" style={{ marginBottom: 10 }}>
                <label>Clave Maestra</label>
                <input
                  type="password"
                  className="ed-input"
                  placeholder="••••••••"
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  required
                />
              </div>
              {!hasMasterPassword && (
                <div className="ed-field" style={{ marginBottom: 10 }}>
                  <label>Confirmar Clave Maestra</label>
                  <input
                    type="password"
                    className="ed-input"
                    placeholder="Repite tu clave"
                    value={authConfirm}
                    onChange={(e) => setAuthConfirm(e.target.value)}
                  />
                </div>
              )}
              <div className="auth-err">{authError}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn-primary">
                  Desbloquear Sistema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`toast${toastVisible ? " show" : ""}`} id="toast">
        {toastMsg}
      </div>
    </>
  );
}
