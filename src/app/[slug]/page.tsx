import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileTerminal from "@/components/ProfileTerminal";
import { readStore } from "@/lib/storage";
import { sanitizeSlug } from "@/types/profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const clean = sanitizeSlug(rawSlug);
  if (!clean || clean === "admin" || clean === "studio" || clean === "sistema") {
    return { title: "Sistema Interno · Creador de Perfiles" };
  }
  const store = await readStore();
  const profile = store.profiles[clean];
  return {
    title: profile ? `${profile.user} · /${clean}` : `404 · /${clean}`,
    description: profile
      ? `${profile.user} (${profile.role}) · ${profile.vibe}`
      : `La ruta /${clean} está disponible para crearse en el sistema`,
  };
}

export default async function PublicProfileSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const clean = sanitizeSlug(rawSlug);

  // Redirigir alias de administración a la raíz /, que es el Sistema Interno
  if (!clean || clean === "admin" || clean === "studio" || clean === "sistema") {
    redirect("/");
  }

  const store = await readStore();
  const defaultSlug = store.adminConfig.defaultSlug || "facxx14";

  return (
    <ProfileTerminal
      mode="public"
      initialSlug={clean}
      initialDefaultSlug={defaultSlug}
      initialProfiles={store.profiles}
      initialHasPassword={Boolean(store.adminConfig.passwordHash)}
    />
  );
}
