"use client";

import { useEffect, useRef } from "react";

// Fundo "tecnológico" pedido pro Creative Canvas — partículas finas que
// reagem ao cursor (empurradas suavemente, nunca seguindo o mouse
// diretamente, pra não distrair de arrastar node). Canvas 2D puro (não
// WebGL — é só um punhado de pontos, WebGL seria peso desnecessário pra
// isso), sempre atrás do React Flow (pointer-events: none — nunca captura
// clique/drag que era pra ir pro canvas de nodes). Respeita
// prefers-reduced-motion: para de animar, fica só como textura estática do
// 1º frame.
interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  raio: number;
}

const DENSIDADE_POR_PIXEL_QUADRADO = 1 / 14000;
const RAIO_INFLUENCIA_CURSOR = 130;
const FORCA_EMPURRAO = 0.028;
const ATRITO = 0.965;
const VELOCIDADE_BASE_MAXIMA = 0.12;

export default function CanvasParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let largura = 0;
    let altura = 0;
    let particulas: Particula[] = [];
    const mouse = { x: -9999, y: -9999 };
    let frameId = 0;

    function criarParticulas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = canvas!.clientWidth;
      altura = canvas!.clientHeight;
      canvas!.width = largura * dpr;
      canvas!.height = altura * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const quantidade = Math.round(largura * altura * DENSIDADE_POR_PIXEL_QUADRADO);
      particulas = Array.from({ length: quantidade }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * VELOCIDADE_BASE_MAXIMA,
        vy: (Math.random() - 0.5) * VELOCIDADE_BASE_MAXIMA,
        raio: 0.7 + Math.random() * 1.1,
      }));
    }

    function desenharFrame() {
      ctx!.clearRect(0, 0, largura, altura);
      const corParticula = "oklch(0.86 0.11 205)"; // --color-menta
      for (const p of particulas) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < RAIO_INFLUENCIA_CURSOR && dist > 0.001) {
          const forca = ((RAIO_INFLUENCIA_CURSOR - dist) / RAIO_INFLUENCIA_CURSOR) * FORCA_EMPURRAO;
          p.vx += (dx / dist) * forca;
          p.vy += (dy / dist) * forca;
        }
        p.vx *= ATRITO;
        p.vy *= ATRITO;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = largura;
        if (p.x > largura) p.x = 0;
        if (p.y < 0) p.y = altura;
        if (p.y > altura) p.y = 0;

        const proximidade = dist < RAIO_INFLUENCIA_CURSOR ? 1 - dist / RAIO_INFLUENCIA_CURSOR : 0;
        ctx!.globalAlpha = 0.18 + proximidade * 0.4;
        ctx!.fillStyle = corParticula;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.raio + proximidade * 1.2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function loop() {
      desenharFrame();
      frameId = requestAnimationFrame(loop);
    }

    function onResize() {
      criarParticulas();
      if (reduzMovimento) desenharFrame();
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function onMouseLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    criarParticulas();
    desenharFrame();
    if (!reduzMovimento) {
      frameId = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
}
