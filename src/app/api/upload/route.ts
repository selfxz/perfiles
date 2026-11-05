import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sanitizeSlug } from "@/types/profile";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const slug = sanitizeSlug((formData.get("slug") as string) || "facxx14") || "facxx14";

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = path.extname(file.name) || ".mp3";
    const safeBase = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const filename = `${slug}-${Date.now()}-${safeBase}${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, filename), buffer);
      return NextResponse.json({
        ok: true,
        url: `/uploads/${filename}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
      });
    } catch {
      // Fallback to dataUrl if running in read-only environment
      const mime = file.type || "audio/mpeg";
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        ok: true,
        url: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, ""),
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

