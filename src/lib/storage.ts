import fs from "fs/promises";
import path from "path";
import {
  AdminConfig,
  DEFAULT_PROFILE,
  normalizeProfile,
  ProfileData,
  sanitizeSlug,
} from "@/types/profile";

export interface StoreSchema {
  adminConfig: AdminConfig;
  profiles: Record<string, ProfileData>;
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
};

// In-memory fallback if running on a read-only serverless filesystem
let memoryStore: StoreSchema | null = null;

export async function readStore(): Promise<StoreSchema> {
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

    if (!profiles.facxx14 && Object.keys(profiles).length === 0) {
      profiles.facxx14 = structuredClone(DEFAULT_PROFILE);
    }

    const defaultSlug =
      parsed.adminConfig?.defaultSlug && profiles[parsed.adminConfig.defaultSlug]
        ? parsed.adminConfig.defaultSlug
        : profiles.facxx14
        ? "facxx14"
        : Object.keys(profiles)[0] || "facxx14";

    const store: StoreSchema = {
      adminConfig: {
        passwordHash: parsed.adminConfig?.passwordHash || null,
        defaultSlug,
        updatedAt: parsed.adminConfig?.updatedAt,
      },
      profiles,
    };
    memoryStore = store;
    return store;
  } catch {
    if (memoryStore) return memoryStore;
    const fresh = structuredClone(INITIAL_STORE);
    await writeStore(fresh);
    return fresh;
  }
}

export async function writeStore(store: StoreSchema): Promise<void> {
  memoryStore = store;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write store.json to disk (using in-memory store):", err);
  }
}
