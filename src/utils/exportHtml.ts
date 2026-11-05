import { ICONS, ProfileData, sanitizeSlug } from "@/types/profile";

function escapeHtml(str: string): string {
  return String(str || "").replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m] || m)
  );
}

export function downloadStaticProfileHtml(profile: ProfileData) {
  const safeName = sanitizeSlug(profile.user || profile.slug) || "perfil";
  const initials = escapeHtml((profile.user || "fx").slice(0, 2).toLowerCase());
  const accent = escapeHtml(profile.accentColor || "#ff1a35");
  const avatarHtml = profile.avatar
    ? `<img src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.user)}" onerror="this.parentElement.textContent='${initials}'" />`
    : initials;

  const circularLinksHtml = (profile.links || [])
    .map(
      (l) => `
      <li class="orb-link-item">
        <a class="orb-link" href="${escapeHtml(l.url || "#")}" target="_blank" rel="noopener noreferrer">
          <div class="orb-circle-wrap">
            <span class="orb-halo"></span>
            <span class="orb-circle">
              <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[l.id] || ICONS.web}</svg>
            </span>
            ${l.badge ? `<span class="orb-badge">${escapeHtml(l.badge)}</span>` : ""}
          </div>
          <div class="orb-label">
            <span class="orb-name">${escapeHtml(l.name)}</span>
            <span class="orb-handle">${escapeHtml(l.handle)}</span>
          </div>
        </a>
      </li>`
    )
    .join("");

  const featuredHtml = (profile.featuredLinks || [])
    .map(
      (f) => `
      <li>
        <a class="featured-card" href="${escapeHtml(f.url || "#")}" target="_blank" rel="noopener noreferrer">
          <span class="featured-orb">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[f.icon] || ICONS.web}</svg>
          </span>
          <span class="featured-text">
            <span class="featured-title-row">
              <span class="featured-title">${escapeHtml(f.title)}</span>
              ${f.badge ? `<span class="featured-badge">${escapeHtml(f.badge)}</span>` : ""}
            </span>
            <span class="featured-sub">${escapeHtml(f.subtitle)}</span>
          </span>
          <span class="featured-go-orb" aria-hidden="true">↗</span>
        </a>
      </li>`
    )
    .join("");

  const copyTagsHtml = (profile.copyTags || [])
    .map(
      (c) => `
      <button type="button" class="copy-tag-pill" onclick="navigator.clipboard.writeText('${escapeHtml(c.value)}'); this.querySelector('.copy-tag-action').textContent='✓'; setTimeout(()=>this.querySelector('.copy-tag-action').textContent='📋', 1500)">
        <span class="copy-tag-orb">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[c.icon] || ICONS.web}</svg>
        </span>
        <span class="copy-tag-info">
          <span class="copy-tag-label">${escapeHtml(c.label)}</span>
          <span class="copy-tag-val">${escapeHtml(c.value)}</span>
        </span>
        <span class="copy-tag-action">📋</span>
      </button>`
    )
    .join("");

  const profileJson = JSON.stringify(profile).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${escapeHtml(profile.user)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050507; --panel: #0d0d12; --panel-2: #13131a; --line: #281519; --line-bright: #421820;
      --fg: #f5f5f7; --muted: #8c8c9a; --accent: ${accent}; --white: #ffffff;
      --display: "Chakra Petch", sans-serif; --mono: "JetBrains Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 14px;
      line-height: 1.55; padding: 28px 16px 48px; margin: 0; position: relative; overflow-x: hidden;
    }
    #rain { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; opacity: 0.34; pointer-events: none; }
    .win {
      position: relative; z-index: 1; max-width: 490px; margin: 0 auto;
      background: rgba(13, 13, 18, 0.92); border: 1px solid var(--line-bright);
      border-radius: 12px; overflow: hidden; box-shadow: 0 26px 80px rgba(0,0,0,0.88);
      backdrop-filter: blur(8px);
    }
    .bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--panel-2); border-bottom: 1px solid var(--line-bright); font-size: 12px; color: var(--muted); }
    .dots { display: flex; gap: 6px; }
    .dots i { width: 10px; height: 10px; border-radius: 50%; display: block; }
    .dots i:nth-child(1) { background: var(--accent); } .dots i:nth-child(2) { background: #fff; } .dots i:nth-child(3) { background: #7f1d1d; }
    .bar .ttl { flex: 1; text-align: center; color: var(--fg); }
    .bar .route-pill { font-size: 10px; color: #fff; background: rgba(255,26,53,0.14); border: 1px solid var(--accent); padding: 1px 7px; border-radius: 999px; }
    section { padding: 18px; border-bottom: 1px dashed var(--line-bright); }
    section:last-of-type { border-bottom: 0; }
    .lbl { margin: 0 0 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #fff; }
    .lbl span::before { content: "// "; color: var(--accent); }
    .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding-top: 28px; }
    .avatar { position: relative; width: 120px; height: 120px; border-radius: 50%; }
    .avatar .ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(var(--accent), #fff, var(--accent), #1a0508 72%, var(--accent)); animation: spin 4.5s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .avatar .face { position: absolute; inset: 4px; border-radius: 50%; background: var(--panel-2); border: 2px solid #050507; display: grid; place-items: center; overflow: hidden; font: 700 36px/1 var(--display); color: #fff; }
    .avatar .face img { width: 100%; height: 100%; object-fit: cover; }
    .glitch { margin: 4px 0 0; font: 700 clamp(2.3rem, 11vw, 3.2rem)/1 var(--display); color: #fff; }
    .tag { margin: 0; min-height: 1.6em; font-size: 14.5px; color: #e2e2e8; }
    .caret { display: inline-block; width: 8px; height: 1.05em; margin-left: 3px; vertical-align: -0.15em; background: var(--accent); animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 4px 0 0; padding: 0; list-style: none; font-size: 12px; }
    .meta li { display: flex; align-items: center; gap: 7px; padding: 5px 12px; border: 1px solid var(--line-bright); border-radius: 999px; background: var(--panel-2); color: var(--fg); }
    .meta svg { width: 14px; height: 14px; stroke: var(--accent); fill: none; stroke-width: 2; }
    .live { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    .circular-links-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px 12px; margin: 0; padding: 0; list-style: none; }
    .orb-link-item { display: flex; justify-content: center; }
    .orb-link { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; text-decoration: none; color: #fff; }
    .orb-circle-wrap { position: relative; width: 72px; height: 72px; display: grid; place-items: center; }
    .orb-halo { position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(var(--accent), transparent, #fff, var(--accent)); opacity: 0.35; }
    .orb-circle { position: relative; width: 68px; height: 68px; border-radius: 50%; background: #0e0e14; border: 1.5px solid var(--line-bright); display: grid; place-items: center; z-index: 1; }
    .orb-circle svg { width: 28px; height: 28px; stroke: var(--accent); fill: none; stroke-width: 1.85; }
    .orb-badge { position: absolute; top: -2px; right: -4px; z-index: 2; background: var(--accent); color: #fff; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 999px; }
    .orb-label { display: flex; flex-direction: column; align-items: center; }
    .orb-name { font-size: 12.5px; font-weight: 700; color: #fff; }
    .orb-handle { font-size: 10.5px; color: var(--muted); }
    .featured-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .featured-card { display: flex; align-items: center; gap: 13px; padding: 10px 12px; border-radius: 999px; border: 1px solid var(--line-bright); background: var(--panel-2); color: #fff; text-decoration: none; }
    .featured-orb { width: 46px; height: 46px; border-radius: 50%; background: #09090d; border: 1px solid var(--accent); display: grid; place-items: center; flex: none; }
    .featured-orb svg { width: 22px; height: 22px; stroke: var(--accent); fill: none; stroke-width: 1.85; }
    .featured-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .featured-title-row { display: flex; align-items: center; gap: 7px; }
    .featured-title { font-weight: 700; font-size: 13px; }
    .featured-badge { font-size: 9px; font-weight: 700; padding: 1.5px 7px; border-radius: 999px; border: 1px solid var(--accent); }
    .featured-sub { font-size: 11.5px; color: var(--muted); }
    .featured-go-orb { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line-bright); display: grid; place-items: center; }
    .copy-tags-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 9px; }
    .copy-tag-pill { display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 8px; border-radius: 999px; border: 1px solid var(--line-bright); background: var(--panel-2); color: #fff; font-family: var(--mono); cursor: pointer; }
    .copy-tag-orb { width: 34px; height: 34px; border-radius: 50%; background: #09090d; border: 1px solid var(--accent); display: grid; place-items: center; }
    .copy-tag-orb svg { width: 16px; height: 16px; stroke: var(--accent); fill: none; stroke-width: 1.9; }
    .copy-tag-info { flex: 1; display: flex; flex-direction: column; text-align: left; }
    .copy-tag-label { font-size: 10px; color: var(--muted); }
    .copy-tag-val { font-size: 12.5px; font-weight: 700; }
    .copy-tag-action { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; }
    footer.foot { display: flex; justify-content: space-between; padding: 12px 18px; background: var(--panel-2); font-size: 11px; color: var(--muted); }
  </style>
</head>
<body>
  <canvas id="rain" aria-hidden="true"></canvas>
  <main class="win">
    <header class="bar">
      <div class="dots"><i></i><i></i><i></i></div>
      <div class="ttl">${escapeHtml(profile.user)}@${escapeHtml(profile.host)}: ~</div>
      <span class="route-pill">/${escapeHtml(profile.slug)}</span>
    </header>
    <section class="hero">
      <div class="avatar"><span class="ring"></span><span class="face">${avatarHtml}</span></div>
      <h1 class="glitch">${escapeHtml(profile.user)}</h1>
      <p class="tag"><span id="tag"></span><span class="caret" aria-hidden="true"></span></p>
      <ul class="meta">
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
          <span>${escapeHtml(profile.place)}</span>
        </li>
        <li><span class="live"></span><span id="clock">--:--:--</span></li>
      </ul>
    </section>
    <section>
      <h2 class="lbl"><span>redes &amp; redirecciones</span></h2>
      <ul class="circular-links-grid">${circularLinksHtml}</ul>
    </section>
    ${
      featuredHtml
        ? `<section><h2 class="lbl"><span>accesos destacados</span></h2><ul class="featured-list">${featuredHtml}</ul></section>`
        : ""
    }
    ${
      copyTagsHtml
        ? `<section><h2 class="lbl"><span>copiar id rápido</span></h2><div class="copy-tags-grid">${copyTagsHtml}</div></section>`
        : ""
    }
    <footer class="foot">
      <span id="up">uptime 00:00:00</span>
      <span>red//black v3.5</span>
    </footer>
  </main>
  <script>
    const ME = ${profileJson};
    (function(){
      const el = document.getElementById("tag");
      const lines = (ME.tagline && ME.tagline.length) ? ME.tagline : ["GG WP"];
      let li = 0, ci = 0, del = false;
      function tick(){
        const line = lines[li % lines.length] || "";
        if (!del) {
          ci++;
          if (ci >= line.length) { del = true; el.textContent = line; return setTimeout(tick, 2100); }
        } else {
          ci--;
          if (ci <= 0) { del = false; ci = 0; li = (li + 1) % lines.length; }
        }
        el.textContent = line.slice(0, ci);
        setTimeout(tick, del ? 26 : 58);
      }
      tick();
    })();
    (function(){
      const pad = (n) => String(n).padStart(2, "0");
      const t0 = Date.now();
      function tickClock(){
        const d = new Date();
        document.getElementById("clock").textContent = d.toTimeString().slice(0, 8) + " · UTC−5";
        const s = Math.floor((Date.now() - t0) / 1000);
        document.getElementById("up").textContent = "uptime " + pad(Math.floor(s/3600)) + ":" + pad(Math.floor(s/60)%60) + ":" + pad(s%60);
      }
      tickClock();
      setInterval(tickClock, 1000);
    })();
    (function(){
      const c = document.getElementById("rain");
      const ctx = c.getContext("2d");
      const chars = "01{}[]<>/=;:()+-*&|$#@アイウエオカキクケコサシスセソ".split("");
      const fs = 16;
      let w = 0, h = 0, cols = 0, drops = [], last = 0;
      function size(){
        w = window.innerWidth; h = window.innerHeight;
        c.width = w; c.height = h;
        cols = Math.ceil(w / fs);
        drops = Array.from({length: cols}, () => Math.random() * -40);
      }
      function draw(ts){
        requestAnimationFrame(draw);
        if (ts - last < 60) return;
        last = ts;
        ctx.fillStyle = "rgba(5, 5, 7, 0.15)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = fs + "px monospace";
        for (let i = 0; i < cols; i++) {
          if (drops[i] > 0) {
            ctx.fillStyle = Math.random() > 0.92 ? "#ffffff" : (ME.accentColor || "#ff1a35");
            ctx.fillText(chars[(Math.random() * chars.length) | 0], i * fs, drops[i] * fs);
          }
          if (drops[i] * fs > h && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }
      size();
      window.addEventListener("resize", size);
      requestAnimationFrame(draw);
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
