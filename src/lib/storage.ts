import fs from "fs/promises";
import path from "path";
import {
  AdminConfig,
  DEFAULT_PROFILE,
  normalizeProfile,
  ProfileData,
  sanitizeSlug,
} from "@/types/profile";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  profileToSupabaseRow,
  SupabaseAdminConfigRow,
  SupabaseProfileRow,
  supabaseRowToProfile,
} from "@/lib/supabase";

export interface StoreSchema {
  adminConfig: AdminConfig;
  profiles: Record<string, ProfileData>;
  storageEngine?: "supabase" | "local";
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const INITIAL_STORE: StoreSchema = {
  adminConfig: {
    passwordHash: null,
    defaultSlug: "facxx14",
  },
  profiles: {
    facxx14: structuredClone(DEFAULT_PROFILE),
  },
  storageEngine: "local",
};

// In-memory fallback if running on a read-only serverless filesystem without Supabase
let memoryStore: StoreSchema | null = null;

async function readLocalStoreFile(): Promise<StoreSchema> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreSchema>;
    const profiles: Record<string, ProfileData> = {};

    if (parsed.profiles && typeof parsed.profiles === "object") {
      for (const [key, val] of Object.entries(parsed.profiles)) {
        const slug = sanitizeSlug(key);
        if (slug) {
          profiles[slug] = normalizeProfile(val, slug);
        }
      }
    }

    if (Object.keys(profiles).length === 0) {
      profiles.facxx14 = structuredClone(DEFAULT_PROFILE);
    }

    const defaultSlug =
      parsed.adminConfig?.defaultSlug && profiles[parsed.adminConfig.defaultSlug]
        ? parsed.adminConfig.defaultSlug
        : Object.keys(profiles)[0] || "facxx14";

    const store: StoreSchema = {
      adminConfig: {
        passwordHash: parsed.adminConfig?.passwordHash || null,
        defaultSlug,
        updatedAt: parsed.adminConfig?.updatedAt,
      },
      profiles,
      storageEngine: "local",
    };
    memoryStore = store;
    return store;
  } catch {
    if (memoryStore) return memoryStore;
    const fresh = structuredClone(INITIAL_STORE);
    await writeLocalStoreFile(fresh);
    return fresh;
  }
}

async function writeLocalStoreFile(store: StoreSchema): Promise<void> {
  memoryStore = store;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload: StoreSchema = {
      adminConfig: store.adminConfig,
      profiles: store.profiles,
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write store.json to disk (using in-memory/Supabase):", err);
  }
}

export async function readStore(): Promise<StoreSchema> {
  const supabase = getSupabaseClient();

  if (supabase && isSupabaseConfigured()) {
    try {
      const [{ data: profileRows, error: profilesErr }, { data: adminRows, error: adminErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase.from("admin_config").select("*").eq("id", 1).limit(1),
        ]);

      if (profilesErr) {
        throw profilesErr;
      }
      if (adminErr) {
        console.warn("Supabase admin_config read warning:", adminErr.message);
      }

      const profiles: Record<string, ProfileData> = {};
      if (Array.isArray(profileRows) && profileRows.length > 0) {
        for (const row of profileRows as SupabaseProfileRow[]) {
          const clean = sanitizeSlug(row.slug);
          if (clean) {
            profiles[clean] = supabaseRowToProfile(row);
          }
        }
      }

      // Auto-seed Supabase from local store.json if the database table is empty
      if (Object.keys(profiles).length === 0) {
        const localSeed = await readLocalStoreFile();
        await syncStoreToSupabase(localSeed);
        return {
          ...localSeed,
          storageEngine: "supabase",
        };
      }

      const adminRow = (adminRows?.[0] as SupabaseAdminConfigRow | undefined) || null;
      const firstSlug = Object.keys(profiles)[0] || "facxx14";
      const defaultSlug =
        adminRow?.default_slug && profiles[adminRow.default_slug]
          ? adminRow.default_slug
          : firstSlug;

      const store: StoreSchema = {
        adminConfig: {
          passwordHash: adminRow?.password_hash || null,
          defaultSlug,
          updatedAt: adminRow?.updated_at,
        },
        profiles,
        storageEngine: "supabase",
      };

      memoryStore = store;
      return store;
    } catch (err) {
      console.warn(
        "Supabase readStore failed; falling back to local data/store.json:",
        err
      );
    }
  }

  return readLocalStoreFile();
}

async function syncStoreToSupabase(store: StoreSchema): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    // 1. Upsert admin_config (id = 1)
    const adminPayload: SupabaseAdminConfigRow = {
      id: 1,
      password_hash: store.adminConfig.passwordHash || null,
      default_slug:
        store.adminConfig.defaultSlug ||
        Object.keys(store.profiles)[0] ||
        "facxx14",
      updated_at: new Date().toISOString(),
    };

    const { error: adminErr } = await supabase
      .from("admin_config")
      .upsert(adminPayload, { onConflict: "id" });

    if (adminErr) {
      console.warn("Supabase admin_config upsert warning:", adminErr.message);
    }

    // 2. Upsert all current profiles
    const rows = Object.values(store.profiles).map((p) => profileToSupabaseRow(p));
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(rows, { onConflict: "slug" });

      if (upsertErr) {
        throw upsertErr;
      }
    }

    // 3. Remove any profiles in Supabase that were deleted from store.profiles
    const activeSlugs = Object.keys(store.profiles);
    const { data: existingRows } = await supabase.from("profiles").select("slug");
    if (Array.isArray(existingRows)) {
      const toDelete = existingRows
        .map((r: { slug: string }) => r.slug)
        .filter((s) => !activeSlugs.includes(sanitizeSlug(s)));

      if (toDelete.length > 0) {
        await supabase.from("profiles").delete().in("slug", toDelete);
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to sync store to Supabase:", err);
    return false;
  }
}

export async function writeStore(store: StoreSchema): Promise<void> {
  memoryStore = store;
  await Promise.all([syncStoreToSupabase(store), writeLocalStoreFile(store)]);
}
