import { NextResponse } from "next/server";
import crypto from "crypto";
import { readStore, writeStore } from "@/lib/storage";

function sha256Server(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    hasPassword: Boolean(store.adminConfig.passwordHash),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, password, newPassword } = body as {
      action?: "verify" | "setup" | "update";
      password?: string;
      newPassword?: string;
    };

    const store = await readStore();
    const existingHash = store.adminConfig.passwordHash;

    if (action === "update") {
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { error: "La nueva clave debe tener al menos 4 caracteres." },
          { status: 400 }
        );
      }
      store.adminConfig.passwordHash = sha256Server(newPassword);
      store.adminConfig.updatedAt = new Date().toISOString();
      await writeStore(store);
      return NextResponse.json({ ok: true, hasPassword: true });
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "La clave debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }

    const inputHash = sha256Server(password);

    if (!existingHash) {
      store.adminConfig.passwordHash = inputHash;
      store.adminConfig.updatedAt = new Date().toISOString();
      await writeStore(store);
      return NextResponse.json({
        ok: true,
        firstSetup: true,
        hasPassword: true,
      });
    }

    if (inputHash === existingHash) {
      return NextResponse.json({
        ok: true,
        firstSetup: false,
        hasPassword: true,
      });
    }

    return NextResponse.json(
      { error: "Acceso denegado: Clave Maestra incorrecta." },
      { status: 401 }
    );
  } catch (err) {
    console.error("POST /api/admin error:", err);
    return NextResponse.json(
      { error: "Error en autenticación de administrador." },
      { status: 500 }
    );
  }
}

