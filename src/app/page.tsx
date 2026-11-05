import type { Metadata } from "next";
import ProfileTerminal from "@/components/ProfileTerminal";
import { readStore } from "@/lib/storage";
import { sanitizeSlug } from "@/types/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sistema Interno · Creador de Perfiles y Rutas",
  description:
    "Sistema interno para crear y editar perfiles de redirección con rutas propias (/ejemplo)",
};

export default async function SystemHomePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; create?: string }>;
}) {
  const store = await readStore();
  const resolvedParams = await searchParams;
  const availableSlugs = Object.keys(store.profiles);
  const fallbackSlug =
    store.adminConfig.defaultSlug && store.profiles[store.adminConfig.defaultSlug]
      ? store.adminConfig.defaultSlug
      : availableSlugs[0] || "facxx14";

  const requestedEdit = resolvedParams.edit ? sanitizeSlug(resolvedParams.edit) : "";
  const initialSlug =
    requestedEdit && store.profiles[requestedEdit] ? requestedEdit : fallbackSlug;

  const initialCreateSlug = resolvedParams.create
    ? sanitizeSlug(resolvedParams.create)
    : "";

  return (
    <ProfileTerminal
      mode="system"
      initialSlug={initialSlug}
      initialDefaultSlug={fallbackSlug}
      initialProfiles={store.profiles}
      initialHasPassword={Boolean(store.adminConfig.passwordHash)}
      initialCreateSlug={initialCreateSlug}
    />
  );
}
