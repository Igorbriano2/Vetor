"use client";

// Editor de canvas do Design — Fabric.js (MIT), spike/base real da Parte 1.
// Nunca reinventa serialização de canvas: o "canvasJson" salvo é sempre
// exatamente o que `canvas.toObject([...CAMPOS_EXTRAS_SERIALIZACAO])` devolve,
// incluindo o metadado `vetorMeta` por objeto (ver lib/design/types.ts) —
// é assim que a logo oficial permanece bloqueada mesmo depois de recarregar
// o projeto.
//
// Undo/redo aqui é um histórico simples de snapshots JSON (não um diff de
// operações) — suficiente pro volume de objetos de uma peça de marketing
// (dezenas, não milhares) e muito mais simples de acertar do que um sistema
// de comandos reversíveis próprio.

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { CAMPOS_EXTRAS_SERIALIZACAO, type VetorObjectMeta } from "@/lib/design/types";

const HISTORICO_MAXIMO = 50;
const AUTOSAVE_DEBOUNCE_MS = 1200;

export interface DesignCanvasEditorProps {
  width: number;
  height: number;
  canvasJsonInicial?: unknown;
  // Chamado (debounced) a cada alteração real — quem monta este componente
  // decide se isso vira um PATCH pro design_projects ou só fica em memória
  // (spike). Nunca chamado com o canvas vazio no primeiro render.
  onAutosave?: (canvasJson: unknown) => void;
  className?: string;
  // Teto de largura EXIBIDA em tela — a peça continua sendo width×height de
  // verdade (é o que é exportado/salvo), só a apresentação encolhe via
  // canvas.setZoom(), nunca via CSS transform (que quebraria o mapeamento
  // de coordenadas do clique/arraste). Achado ao vivo: sem isso, uma peça
  // 1080×1080 estoura a largura da tela.
  maxDisplayWidth?: number;
}

// Achado ao vivo: o canvas do Fabric usa a Canvas 2D API do navegador pra
// desenhar texto — se a @font-face declarada em globals.css ainda não
// carregou de verdade quando o objeto é desenhado, o navegador silenciosamente
// desenha com a fonte de fallback (nunca lança erro), e o canvas NÃO se
// redesenha sozinho quando a fonte termina de carregar depois (diferente de
// texto em HTML normal). Por isso: força document.fonts.load() de cada
// família+peso realmente usado nos objetos carregados, espera terminar, e
// só então manda um renderAll() extra — garante a mesma fonte que o
// servidor usou pra gerar o preview (ver apps/agentes/.../designFonts.ts).
async function garantirFontesCarregadas(canvas: fabric.Canvas): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const combinacoes = new Set<string>();
  for (const obj of canvas.getObjects()) {
    const textObj = obj as unknown as { fontFamily?: string; fontWeight?: string | number; fontSize?: number };
    if (!textObj.fontFamily) continue;
    const peso = textObj.fontWeight === "bold" || textObj.fontWeight === 700 ? "700" : "400";
    combinacoes.add(`${peso} ${Math.round(textObj.fontSize ?? 40)}px "${textObj.fontFamily}"`);
  }
  if (combinacoes.size === 0) return;
  try {
    await Promise.all([...combinacoes].map((fonte) => document.fonts.load(fonte)));
    await document.fonts.ready;
  } catch {
    // Fonte não encontrada entre as @font-face declaradas (ex: fallback
    // "sans") — o navegador já cai pro sans-serif padrão sozinho, nada a
    // fazer aqui.
  }
  canvas.renderAll();
}

function objetoEhLogoOficial(obj: fabric.FabricObject): boolean {
  const meta = (obj.get("vetorMeta") as VetorObjectMeta | undefined) ?? undefined;
  return !!meta?.isOfficialLogo;
}

// Logo oficial: selecionável (pra dar feedback visual de "isso é a logo"),
// mas nunca editável/movível/redimensionável/removível sem a ação explícita
// de destravar — nunca destrava sozinho ao carregar o projeto.
function aplicarBloqueioDeLogo(obj: fabric.FabricObject): void {
  obj.set({
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    editable: false,
  });
}

export default function DesignCanvasEditor({
  width,
  height,
  canvasJsonInicial,
  onAutosave,
  className = "",
  maxDisplayWidth = 640,
}: DesignCanvasEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const historicoRef = useRef<{ pilha: string[]; indice: number; suprimirRegistro: boolean }>({
    pilha: [],
    indice: -1,
    suprimirRegistro: false,
  });
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pronto, setPronto] = useState(false);
  const [objetoSelecionado, setObjetoSelecionado] = useState<fabric.FabricObject | null>(null);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);

  const registrarHistorico = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historicoRef.current.suprimirRegistro) return;
    const snapshot = JSON.stringify(canvas.toObject([...CAMPOS_EXTRAS_SERIALIZACAO]));
    const h = historicoRef.current;
    // Descarta qualquer "futuro" de redo ao registrar um novo estado.
    h.pilha = h.pilha.slice(0, h.indice + 1);
    h.pilha.push(snapshot);
    if (h.pilha.length > HISTORICO_MAXIMO) h.pilha.shift();
    h.indice = h.pilha.length - 1;
    setPodeDesfazer(h.indice > 0);
    setPodeRefazer(false);
  }, []);

  const agendarAutosave = useCallback(() => {
    if (!onAutosave) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      onAutosave(canvas.toObject([...CAMPOS_EXTRAS_SERIALIZACAO]));
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [onAutosave]);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = canvas;

    const escala = Math.min(1, maxDisplayWidth / width);
    if (escala < 1) {
      canvas.setDimensions({ width: width * escala, height: height * escala });
      canvas.setZoom(escala);
    }

    // O construtor não desenha nada sozinho quando não há objeto nenhum
    // ainda (achado ao vivo: sem isto, um canvas novo em branco fica com o
    // pixel realmente transparente, não branco — mesmo com backgroundColor
    // setado) — sempre força o primeiro render explícito.
    canvas.renderAll();

    // Achado ao vivo: um projeto novo grava canvas_json como "{}" (jsonb
    // default), que é truthy em JS — canvas.loadFromJSON({}) carrega um
    // estado "vazio" que sobrescreve até o backgroundColor, deixando o
    // canvas literalmente transparente em vez de branco. Só entra no
    // caminho de load quando existe conteúdo real (objects/background).
    const temConteudoReal =
      !!canvasJsonInicial && typeof canvasJsonInicial === "object" && Object.keys(canvasJsonInicial).length > 0;

    if (temConteudoReal) {
      historicoRef.current.suprimirRegistro = true;
      void canvas.loadFromJSON(canvasJsonInicial).then(() => {
        // Reaplica o bloqueio de logo após o load — nunca confia que o JSON
        // salvo preservou os campos de lock corretamente (defesa em
        // profundidade: o metadado vetorMeta é a fonte de verdade, não os
        // campos lockX/lockY que o JSON também carrega).
        for (const obj of canvas.getObjects()) {
          if (objetoEhLogoOficial(obj)) aplicarBloqueioDeLogo(obj);
        }
        canvas.renderAll();
        void garantirFontesCarregadas(canvas);
        historicoRef.current.suprimirRegistro = false;
        registrarHistorico();
        setPronto(true);
      });
    } else {
      registrarHistorico();
      // setState precisa vir de um callback, não direto no corpo síncrono do
      // efeito (mesma regra que o ramo async acima já respeita ao rodar
      // dentro do .then()) — queueMicrotask mantém o mesmo comportamento
      // (roda ainda antes da próxima pintura) sem disparar o lint de
      // "setState síncrono dentro de efeito".
      queueMicrotask(() => setPronto(true));
    }

    const aoSelecionar = () => setObjetoSelecionado(canvas.getActiveObject() ?? null);
    const aoLimparSelecao = () => setObjetoSelecionado(null);
    const aoModificar = () => {
      registrarHistorico();
      agendarAutosave();
    };

    canvas.on("selection:created", aoSelecionar);
    canvas.on("selection:updated", aoSelecionar);
    canvas.on("selection:cleared", aoLimparSelecao);
    canvas.on("object:modified", aoModificar);
    canvas.on("object:added", aoModificar);
    canvas.on("object:removed", aoModificar);
    canvas.on("text:changed", aoModificar);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adicionarTexto() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const texto = new fabric.Textbox("Novo texto", {
      left: width / 4,
      top: height / 4,
      width: width / 2,
      fontSize: 32,
      fill: "#111111",
      fontFamily: "Arial",
    });
    texto.set("vetorMeta", { role: "texto" } satisfies VetorObjectMeta);
    canvas.add(texto);
    canvas.setActiveObject(texto);
    canvas.renderAll();
  }

  function duplicarSelecionado() {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo || objetoEhLogoOficial(ativo)) return; // nunca duplica a logo oficial
    void ativo.clone().then((clone: fabric.FabricObject) => {
      clone.set({ left: (ativo.left ?? 0) + 20, top: (ativo.top ?? 0) + 20 });
      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.renderAll();
    });
  }

  function removerSelecionado() {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo || objetoEhLogoOficial(ativo)) return; // nunca remove a logo oficial por aqui
    canvas.remove(ativo);
    canvas.discardActiveObject();
    canvas.renderAll();
  }

  function alternarVisibilidadeSelecionado() {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo) return;
    ativo.set("visible", !ativo.visible);
    canvas.renderAll();
    registrarHistorico();
    agendarAutosave();
  }

  // Bloqueio manual (qualquer elemento, não só a logo) — pedido explícito da
  // spec ("bloquear" como ação própria, separada do bloqueio automático da
  // logo). Reusa os mesmos campos lockX/Y/Scaling/Rotation que a logo usa,
  // mas sem o vetorMeta.isOfficialLogo — então nunca é confundido com a
  // trava automática nem some se o usuário desbloquear manualmente.
  function alternarBloqueioSelecionado() {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo || objetoEhLogoOficial(ativo)) return; // logo oficial só destrava por ação do BrandKit
    const bloqueado = !!ativo.lockMovementX;
    ativo.set({
      lockMovementX: !bloqueado,
      lockMovementY: !bloqueado,
      lockScalingX: !bloqueado,
      lockScalingY: !bloqueado,
      lockRotation: !bloqueado,
      hasControls: bloqueado,
    });
    canvas.renderAll();
    registrarHistorico();
    agendarAutosave();
  }

  function aplicarPropriedadeTexto(propriedade: "fontFamily" | "fontSize" | "fill" | "textAlign", valor: string | number) {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo || objetoEhLogoOficial(ativo)) return;
    ativo.set(propriedade, valor);
    canvas.renderAll();
    registrarHistorico();
    agendarAutosave();
  }

  function aplicarPosicao(eixo: "left" | "top", valor: number) {
    const canvas = fabricCanvasRef.current;
    const ativo = canvas?.getActiveObject();
    if (!canvas || !ativo || objetoEhLogoOficial(ativo)) return;
    ativo.set(eixo, valor);
    ativo.setCoords();
    canvas.renderAll();
    registrarHistorico();
    agendarAutosave();
  }

  function restaurarSnapshot(snapshotJson: string) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    historicoRef.current.suprimirRegistro = true;
    void canvas.loadFromJSON(JSON.parse(snapshotJson)).then(() => {
      for (const obj of canvas.getObjects()) {
        if (objetoEhLogoOficial(obj)) aplicarBloqueioDeLogo(obj);
      }
      canvas.renderAll();
      void garantirFontesCarregadas(canvas);
      historicoRef.current.suprimirRegistro = false;
      agendarAutosave();
    });
  }

  function desfazer() {
    const h = historicoRef.current;
    if (h.indice <= 0) return;
    h.indice -= 1;
    restaurarSnapshot(h.pilha[h.indice]!);
    setPodeDesfazer(h.indice > 0);
    setPodeRefazer(true);
  }

  function refazer() {
    const h = historicoRef.current;
    if (h.indice >= h.pilha.length - 1) return;
    h.indice += 1;
    restaurarSnapshot(h.pilha[h.indice]!);
    setPodeDesfazer(true);
    setPodeRefazer(h.indice < h.pilha.length - 1);
  }

  function exportarImagem(formato: "png" | "jpeg"): void {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: formato, multiplier: 2, quality: 0.92 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `design.${formato === "jpeg" ? "jpg" : "png"}`;
    link.click();
  }

  const selecaoEhLogo = objetoSelecionado ? objetoEhLogoOficial(objetoSelecionado) : false;
  const selecaoEhTexto = objetoSelecionado instanceof fabric.Textbox || objetoSelecionado instanceof fabric.IText;

  return (
    <div className={`flex gap-4 ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={adicionarTexto} className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5">
            + Texto
          </button>
          <button
            type="button"
            onClick={duplicarSelecionado}
            disabled={!objetoSelecionado || selecaoEhLogo}
            className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30"
          >
            Duplicar
          </button>
          <button
            type="button"
            onClick={alternarVisibilidadeSelecionado}
            disabled={!objetoSelecionado}
            className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30"
          >
            Ocultar/mostrar
          </button>
          <button
            type="button"
            onClick={alternarBloqueioSelecionado}
            disabled={!objetoSelecionado || selecaoEhLogo}
            className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30"
          >
            {objetoSelecionado?.lockMovementX ? "Desbloquear" : "Bloquear"}
          </button>
          <button
            type="button"
            onClick={removerSelecionado}
            disabled={!objetoSelecionado || selecaoEhLogo}
            className="rounded-lg border border-coral/30 px-3 py-1.5 text-xs text-coral hover:bg-coral/10 disabled:opacity-30"
          >
            Remover
          </button>
          <button type="button" onClick={desfazer} disabled={!podeDesfazer} className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30">
            Desfazer
          </button>
          <button type="button" onClick={refazer} disabled={!podeRefazer} className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30">
            Refazer
          </button>
          <button type="button" onClick={() => exportarImagem("png")} className="rounded-lg border border-menta/30 px-3 py-1.5 text-xs text-menta hover:bg-menta/10">
            Exportar PNG
          </button>
          <button type="button" onClick={() => exportarImagem("jpeg")} className="rounded-lg border border-menta/30 px-3 py-1.5 text-xs text-menta hover:bg-menta/10">
            Exportar JPG
          </button>
        </div>

        <canvas ref={canvasElRef} aria-label="Área de edição da peça de design" />
        {!pronto && <p className="text-xs text-areia/40">Carregando editor...</p>}
      </div>

      <div className="w-56 shrink-0 space-y-3 rounded-xl border border-areia/10 bg-petroleo-2/60 p-3">
        <p className="mono-label text-areia/50">Propriedades</p>
        {!objetoSelecionado && <p className="text-xs text-areia/40">Selecione um elemento no canvas.</p>}
        {selecaoEhLogo && (
          <p className="text-xs text-ambar">
            Logo oficial — bloqueada por padrão. Peça uma exceção explícita nas regras do BrandKit pra editar.
          </p>
        )}
        {objetoSelecionado && !selecaoEhLogo && selecaoEhTexto && (
          <div className="space-y-2">
            <label className="block text-xs text-areia/60">
              Tamanho da fonte
              <input
                type="number"
                defaultValue={(objetoSelecionado as fabric.Textbox).fontSize}
                onChange={(e) => aplicarPropriedadeTexto("fontSize", Number(e.target.value))}
                className="mt-1 w-full rounded border border-areia/15 bg-petroleo px-2 py-1 text-areia"
              />
            </label>
            <label className="block text-xs text-areia/60">
              Cor
              <input
                type="color"
                defaultValue={String((objetoSelecionado as fabric.Textbox).fill ?? "#111111")}
                onChange={(e) => aplicarPropriedadeTexto("fill", e.target.value)}
                className="mt-1 h-8 w-full rounded border border-areia/15 bg-petroleo"
              />
            </label>
            <label className="block text-xs text-areia/60">
              Alinhamento
              <select
                defaultValue={(objetoSelecionado as fabric.Textbox).textAlign}
                onChange={(e) => aplicarPropriedadeTexto("textAlign", e.target.value)}
                className="mt-1 w-full rounded border border-areia/15 bg-petroleo px-2 py-1 text-areia"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
          </div>
        )}
        {objetoSelecionado && !selecaoEhLogo && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-areia/60">
              X
              <input
                type="number"
                defaultValue={Math.round(objetoSelecionado.left ?? 0)}
                onChange={(e) => aplicarPosicao("left", Number(e.target.value))}
                className="mt-1 w-full rounded border border-areia/15 bg-petroleo px-2 py-1 text-areia"
              />
            </label>
            <label className="block text-xs text-areia/60">
              Y
              <input
                type="number"
                defaultValue={Math.round(objetoSelecionado.top ?? 0)}
                onChange={(e) => aplicarPosicao("top", Number(e.target.value))}
                className="mt-1 w-full rounded border border-areia/15 bg-petroleo px-2 py-1 text-areia"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

export { objetoEhLogoOficial, aplicarBloqueioDeLogo };
