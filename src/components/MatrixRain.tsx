"use client";

import React, { useEffect, useRef } from "react";
import { BgEffect } from "@/types/profile";

export default function MatrixRain({
  color = "#ff1a35",
  secondaryColor = "#ffffff",
  effect = "matrix",
  enabled = true,
}: {
  color?: string;
  secondaryColor?: string;
  effect?: BgEffect;
  enabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const activeEffect: BgEffect = !enabled ? "none" : effect || "matrix";
    if (activeEffect === "none") {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let animId = 0;
    let last = 0;

    // Matrix state
    const chars = "01{}[]<>/=;:()+-*&|$#@アイウエオカキクケコサシスセソ".split("");
    const fs = 16;
    let cols = 0;
    let drops: number[] = [];

    // Particles / Constellation state
    interface NodeParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      alt: boolean;
    }
    let nodes: NodeParticle[] = [];

    // Embers state
    interface Ember {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      alpha: number;
      phase: number;
      alt: boolean;
    }
    let embers: Ember[] = [];

    // Starfield state
    interface Star3D {
      x: number;
      y: number;
      z: number;
      pz: number;
      alt: boolean;
    }
    let stars: Star3D[] = [];

    // Cybergrid state
    let gridOffset = 0;

    function initScene() {
      if (!c || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, w, h);

      if (activeEffect === "matrix") {
        cols = Math.ceil(w / fs);
        drops = Array.from({ length: cols }, () => Math.random() * -40);
      } else if (activeEffect === "particles") {
        const count = Math.min(75, Math.max(32, Math.floor((w * h) / 18000)));
        nodes = Array.from({ length: count }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.75,
          vy: (Math.random() - 0.5) * 0.75,
          r: 1.5 + Math.random() * 2,
          alt: i % 4 === 0,
        }));
      } else if (activeEffect === "embers") {
        const count = Math.min(90, Math.max(40, Math.floor((w * h) / 14000)));
        embers = Array.from({ length: count }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: -(0.5 + Math.random() * 1.6),
          vx: (Math.random() - 0.5) * 0.5,
          size: 1.2 + Math.random() * 3.4,
          alpha: 0.25 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          alt: i % 3 === 0,
        }));
      } else if (activeEffect === "starfield") {
        const count = 140;
        stars = Array.from({ length: count }, (_, i) => {
          const z = Math.random() * w;
          return {
            x: (Math.random() - 0.5) * w * 1.6,
            y: (Math.random() - 0.5) * h * 1.6,
            z,
            pz: z,
            alt: i % 4 === 0,
          };
        });
      }
    }

    function draw(ts: number) {
      animId = requestAnimationFrame(draw);
      if (!ctx || document.hidden) return;

      if (activeEffect === "matrix") {
        if (ts - last < 58) return;
        last = ts;
        ctx.fillStyle = "rgba(5, 5, 7, 0.16)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = `${fs}px 'JetBrains Mono', monospace`;
        for (let i = 0; i < cols; i++) {
          if (drops[i] > 0) {
            ctx.fillStyle =
              Math.random() > 0.88 ? secondaryColor || "#ffffff" : color;
            ctx.fillText(
              chars[(Math.random() * chars.length) | 0],
              i * fs,
              drops[i] * fs
            );
          }
          if (drops[i] * fs > h && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
        return;
      }

      if (activeEffect === "particles") {
        ctx.clearRect(0, 0, w, h);
        const maxDist = 135;

        for (let i = 0; i < nodes.length; i++) {
          const p = nodes[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;

          for (let j = i + 1; j < nodes.length; j++) {
            const q = nodes[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const dist = Math.hypot(dx, dy);
            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * 0.42;
              ctx.strokeStyle = p.alt ? secondaryColor : color;
              ctx.globalAlpha = alpha;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }

          ctx.globalAlpha = 0.85;
          ctx.fillStyle = p.alt ? secondaryColor : color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }

      if (activeEffect === "embers") {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i];
          e.phase += 0.03;
          e.x += e.vx + Math.sin(e.phase) * 0.35;
          e.y += e.vy;

          if (e.y < -15) {
            e.y = h + 15;
            e.x = Math.random() * w;
          }
          if (e.x < -15) e.x = w + 15;
          if (e.x > w + 15) e.x = -15;

          const glowColor = e.alt ? secondaryColor : color;
          ctx.save();
          ctx.globalAlpha = e.alpha * (0.65 + 0.35 * Math.sin(e.phase * 1.5));
          ctx.shadowBlur = 14;
          ctx.shadowColor = glowColor;
          ctx.fillStyle = glowColor;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        return;
      }

      if (activeEffect === "starfield") {
        ctx.fillStyle = "rgba(5, 5, 7, 0.32)";
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const speed = 7.5;

        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.pz = s.z;
          s.z -= speed;
          if (s.z <= 2) {
            s.x = (Math.random() - 0.5) * w * 1.6;
            s.y = (Math.random() - 0.5) * h * 1.6;
            s.z = w;
            s.pz = w;
          }

          const sx = cx + (s.x / s.z) * (w * 0.65);
          const sy = cy + (s.y / s.z) * (h * 0.65);
          const px = cx + (s.x / s.pz) * (w * 0.65);
          const py = cy + (s.y / s.pz) * (h * 0.65);

          const ratio = 1 - s.z / w;
          ctx.strokeStyle = s.alt ? secondaryColor : color;
          ctx.lineWidth = Math.max(0.6, ratio * 2.8);
          ctx.globalAlpha = Math.min(1, ratio * 1.15);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        return;
      }

      if (activeEffect === "cybergrid") {
        ctx.clearRect(0, 0, w, h);
        const horizon = h * 0.42;
        gridOffset = (gridOffset + 0.9) % 40;

        // Horizon glow
        const grad = ctx.createRadialGradient(
          w / 2,
          horizon,
          10,
          w / 2,
          horizon,
          Math.max(w, h) * 0.55
        );
        grad.addColorStop(0, color);
        grad.addColorStop(0.28, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        // Perspective vertical lines from center horizon
        const numV = 24;
        ctx.globalAlpha = 0.35;
        for (let i = -numV; i <= numV; i++) {
          const bx = w / 2 + i * (w / 10);
          ctx.beginPath();
          ctx.moveTo(w / 2 + i * 14, horizon);
          ctx.lineTo(bx, h);
          ctx.stroke();
        }

        // Moving horizontal lines
        for (let d = 0; d < 18; d++) {
          const progress = ((d * 40 + gridOffset) / 720) ** 1.75;
          const y = horizon + progress * (h - horizon);
          if (y >= horizon && y <= h) {
            ctx.globalAlpha = Math.min(0.6, progress * 0.75);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    initScene();
    window.addEventListener("resize", initScene);
    if (!reduce) {
      animId = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", initScene);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [color, secondaryColor, effect, enabled]);

  if (!enabled || effect === "none") return null;

  return <canvas id="rain" ref={canvasRef} aria-hidden="true" />;
}
