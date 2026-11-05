import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readStore, writeStore } from "@/lib/storage";
import { normalizeProfile, ProfileData, sanitizeSlug } from "@/types/profile";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    profiles: store.profiles,
    defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    hasPassword: Boolean(store.adminConfig.passwordHash),
    storageEngine: store.storageEngine || "local",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const slug = sanitizeSlug(body.slug || body.profile?.slug);
    if (!slug || slug === "admin" || slug === "studio" || slug === "api") {
      return NextResponse.json(
        { error: "Identificador de ruta inválido o reservado." },
        { status: 400 }
      );
    }

    const store = await readStore();
    const profile = normalizeProfile(body.profile || body, slug);
    store.profiles[slug] = profile;
    await writeStore(store);

    try {
      revalidatePath("/");
      revalidatePath(`/${slug}`);
    } catch {}

    return NextResponse.json({
      ok: true,
      slug,
      profile,
      profiles: store.profiles,
      defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    });
  } catch (err) {
    console.error("POST /api/profiles error:", err);
    return NextResponse.json(
      { error: "No se pudo guardar el perfil." },
      { status: 500 }
    );
  }
}

// Bulk import / sync multiple profiles at once
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const incoming = body.profiles as Record<string, Partial<ProfileData>> | undefined;
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { error: "Formato de perfiles inválido." },
        { status: 400 }
      );
    }

    const store = await readStore();
    for (const [rawKey, rawProfile] of Object.entries(incoming)) {
      const clean = sanitizeSlug(rawKey || rawProfile?.slug);
      if (clean && clean !== "admin" && clean !== "studio" && clean !== "api") {
        store.profiles[clean] = normalizeProfile(rawProfile, clean);
      }
    }

    if (body.defaultSlug) {
      const cleanDef = sanitizeSlug(body.defaultSlug);
      if (cleanDef && store.profiles[cleanDef]) {
        store.adminConfig.defaultSlug = cleanDef;
      }
    }

    await writeStore(store);
    try {
      revalidatePath("/");
    } catch {}

    return NextResponse.json({
      ok: true,
      profiles: store.profiles,
      defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    });
  } catch (err) {
    console.error("PUT /api/profiles error:", err);
    return NextResponse.json(
      { error: "No se pudieron importar los perfiles." },
      { status: 500 }
    );
  }
}
