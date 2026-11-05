import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readStore, writeStore } from "@/lib/storage";
import { normalizeProfile, sanitizeSlug } from "@/types/profile";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await context.params;
  const slug = sanitizeSlug(rawSlug);
  const store = await readStore();
  const profile = store.profiles[slug];

  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    profile,
    defaultSlug: store.adminConfig.defaultSlug || "facxx14",
  });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = sanitizeSlug(rawSlug);
    if (!slug || slug === "admin" || slug === "studio" || slug === "api") {
      return NextResponse.json({ error: "Ruta inválida o reservada." }, { status: 400 });
    }

    const body = await req.json();
    const store = await readStore();
    const updated = normalizeProfile(body.profile || body, slug);
    store.profiles[slug] = updated;
    await writeStore(store);

    try {
      revalidatePath("/");
      revalidatePath(`/${slug}`);
    } catch {}

    return NextResponse.json({
      ok: true,
      slug,
      profile: updated,
      profiles: store.profiles,
      defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    });
  } catch (err) {
    console.error("PUT /api/profiles/[slug] error:", err);
    return NextResponse.json(
      { error: "Error actualizando el perfil." },
      { status: 500 }
    );
  }
}

// Rename route (/oldSlug -> /newSlug) or set as defaultSlug
export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawOldSlug } = await context.params;
    const oldSlug = sanitizeSlug(rawOldSlug);
    const body = await req.json();
    const store = await readStore();

    if (!store.profiles[oldSlug]) {
      return NextResponse.json({ error: "Perfil original no existe." }, { status: 404 });
    }

    if (body.setAsDefault) {
      store.adminConfig.defaultSlug = oldSlug;
      await writeStore(store);
      try {
        revalidatePath("/");
      } catch {}
      return NextResponse.json({
        ok: true,
        defaultSlug: oldSlug,
        profiles: store.profiles,
      });
    }

    const newSlug = sanitizeSlug(body.newSlug);
    if (!newSlug || newSlug === "admin" || newSlug === "studio" || newSlug === "api") {
      return NextResponse.json(
        { error: "Nueva ruta inválida o reservada." },
        { status: 400 }
      );
    }

    if (newSlug !== oldSlug && store.profiles[newSlug]) {
      return NextResponse.json(
        { error: `La ruta /${newSlug} ya está en uso.` },
        { status: 409 }
      );
    }

    const moved = normalizeProfile(
      { ...store.profiles[oldSlug], slug: newSlug },
      newSlug
    );
    store.profiles[newSlug] = moved;
    if (newSlug !== oldSlug) {
      delete store.profiles[oldSlug];
    }

    if (store.adminConfig.defaultSlug === oldSlug) {
      store.adminConfig.defaultSlug = newSlug;
    }

    await writeStore(store);

    try {
      revalidatePath("/");
      revalidatePath(`/${oldSlug}`);
      revalidatePath(`/${newSlug}`);
    } catch {}

    return NextResponse.json({
      ok: true,
      oldSlug,
      newSlug,
      profile: moved,
      profiles: store.profiles,
      defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    });
  } catch (err) {
    console.error("PATCH /api/profiles/[slug] error:", err);
    return NextResponse.json(
      { error: "No se pudo renombrar la ruta." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = sanitizeSlug(rawSlug);
    const store = await readStore();

    if (Object.keys(store.profiles).length <= 1) {
      return NextResponse.json(
        { error: "Debe existir al menos un perfil activo." },
        { status: 400 }
      );
    }

    delete store.profiles[slug];
    if (store.adminConfig.defaultSlug === slug) {
      store.adminConfig.defaultSlug = Object.keys(store.profiles)[0] || "facxx14";
    }
    await writeStore(store);

    try {
      revalidatePath("/");
      revalidatePath(`/${slug}`);
    } catch {}

    return NextResponse.json({
      ok: true,
      slug,
      profiles: store.profiles,
      defaultSlug: store.adminConfig.defaultSlug || "facxx14",
    });
  } catch (err) {
    console.error("DELETE /api/profiles/[slug] error:", err);
    return NextResponse.json(
      { error: "Error eliminando el perfil." },
      { status: 500 }
    );
  }
}
