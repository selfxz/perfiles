import { NextResponse } from "next/server";

/**
 * Convierte enlaces compartidos de Dropbox o Google Drive en URLs de descarga directa de audio.
 */
function normalizeDirectAudioUrl(rawUrl: string): string {
  const url = rawUrl.trim();

  // Dropbox: https://www.dropbox.com/... -> https://dl.dropboxusercontent.com/...
  if (url.includes("dropbox.com")) {
    return url
      .replace("www.dropbox.com", "dl.dropboxusercontent.com")
      .replace("dropbox.com", "dl.dropboxusercontent.com")
      .replace(/[?&]dl=0/, "")
      .replace(/[?&]dl=1/, "");
  }

  // Google Drive: https://drive.google.com/file/d/FILE_ID/view -> https://drive.google.com/uc?export=download&id=FILE_ID
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  // GitHub blob -> raw.githubusercontent.com
  if (url.includes("github.com") && url.includes("/blob/")) {
    return url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
  }

  return url;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  const isMeta = searchParams.get("meta") === "1";

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  // Consulta rápida de metadatos oEmbed (YouTube, SoundCloud, Spotify)
  if (isMeta) {
    try {
      let oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`;
      if (targetUrl.includes("open.spotify.com")) {
        oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`;
      }
      const res = await fetch(oembedUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false }, { status: 200 });
      }
      const data = await res.json();
      return NextResponse.json({
        ok: true,
        title: data.title || "",
        artist: data.author_name || data.provider_name || "",
        thumbnail: data.thumbnail_url || "",
      });
    } catch {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
  }

  // Proxy de streaming de audio para evitar bloqueos de CORS / Referer / Google Drive / Dropbox
  try {
    const resolvedUrl = normalizeDirectAudioUrl(targetUrl);
    const rangeHeader = req.headers.get("range");

    const fetchHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "audio/*,*/*;q=0.9",
    };
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const upstream = await fetch(resolvedUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `No se pudo obtener el audio (${upstream.status})` },
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges") || "bytes";

    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Type",
      contentType.includes("text/html") ? "audio/mpeg" : contentType
    );
    responseHeaders.set("Accept-Ranges", acceptRanges);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return NextResponse.json(
      { error: "Error al transmitir el enlace de audio." },
      { status: 500 }
    );
  }
}
