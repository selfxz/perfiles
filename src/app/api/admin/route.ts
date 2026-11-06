import { NextResponse } from "next/server";
import crypto from "crypto";
import { readStore, writeStore } from "@/lib/storage";

function sha256Server(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function GET() {
  const store = await readStore();
  const envKey = (process.env.ADMIN_ACCESS_KEY || "").trim();
  return NextResponse.json({
    hasPassword: Boolean(store.adminConfig.passwordHash || envKey),
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
    const envAccessKey = (process.env.ADMIN_ACCESS_KEY || "").trim();

    if (action === "update") {
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { error: "La nueva llave de acceso debe tener al menos 4 caracteres." },
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
        { error: "La llave de acceso debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }

    const inputHash = sha256Server(password);

    if (!existingHash && !envAccessKey) {
      store.adminConfig.passwordHash = inputHash;
      store.adminConfig.updatedAt = new Date().toISOString();
      await writeStore(store);
      return NextResponse.json({
        ok: true,
        firstSetup: true,
        hasPassword: true,
      });
    }

    const matchesStoredHash = Boolean(existingHash && inputHash === existingHash);
    const matchesEnvKey = Boolean(envAccessKey && password === envAccessKey);

    if (matchesStoredHash || matchesEnvKey) {
      return NextResponse.json({
        ok: true,
        firstSetup: false,
        hasPassword: true,
      });
    }

    return NextResponse.json(
      { error: "Acceso denegado: Llave de Acceso incorrecta." },
      { status: 401 }
    );
  } catch (err) {
    console.error("POST /api/admin error:", err);
    return NextResponse.json(
      { error: "Error verificando la Llave de Acceso." },
      { status: 500 }
    );
  }
}
