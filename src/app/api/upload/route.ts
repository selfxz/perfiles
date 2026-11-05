import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sanitizeSlug } from "@/types/profile";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const slug =
      sanitizeSlug((formData.get("slug") as string) || "facxx14") || "facxx14";

    if (!file) {
      return NextResponse.json(
        { error: "No se envió ningún archivo." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = path.extname(file.name) || ".mp3";
    const safeBase = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const filename = `${slug}-${Date.now()}-${safeBase}${ext}`;
    const mime = file.type || "audio/mpeg";

    // 1. Try uploading to Supabase Storage bucket ("profile-assets") if configured
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const storagePath = `${slug}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-assets")
          .upload(storagePath, buffer, {
            contentType: mime,
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("profile-assets")
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) {
            return NextResponse.json({
              ok: true,
              url: publicUrlData.publicUrl,
              title: file.name.replace(/\.[^/.]+$/, ""),
              storageEngine: "supabase",
            });
          }
        } else {
          console.warn(
            "Supabase Storage upload warning (falling back to local/dataUrl):",
            uploadError.message
          );
        }
      } catch (err) {
        console.warn("Supabase Storage upload error:", err);
      }
    }

    // 2. Local filesystem fallback
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, filename), buffer);
      return NextResponse.json({
        ok: true,
        url: `/uploads/${filename}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        storageEngine: "local",
      });
    } catch {
      // 3. Fallback to dataUrl if running in read-only environment
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        ok: true,
        url: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, ""),
        storageEngine: "inline",
      });
    }
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json(
      { error: "Error al subir el archivo." },
      { status: 500 }
    );
  }
}
