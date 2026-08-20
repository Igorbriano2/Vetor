import { describe, expect, it } from "vitest";
import { calcularLayoutDoCanvas, LARGURA_NO, ALTURA_NO } from "./layout";

describe("calcularLayoutDoCanvas", () => {
  it("devolve vazio pra lista de etapas vazia", () => {
    const layout = calcularLayoutDoCanvas([]);
    expect(layout.nos).toHaveLength(0);
    expect(layout.arestas).toHaveLength(0);
    expect(layout.largura).toBe(0);
  });

  it("coloca uma etapa sem dependência no nível 0 (x=0)", () => {
    const layout = calcularLayoutDoCanvas([{ id: "a", agente: "estrategia", tarefa: "t", status: "completed", dependeDe: [] }]);
    expect(layout.nos).toHaveLength(1);
    expect(layout.nos[0].x).toBe(0);
    expect(layout.nos[0].y).toBe(0);
  });

  it("coloca uma etapa dependente uma coluna à frente da que ela depende", () => {
    const layout = calcularLayoutDoCanvas([
      { id: "a", agente: "estrategia", tarefa: "mapear", status: "completed", dependeDe: [] },
      { id: "b", agente: "estrategia", tarefa: "consolidar", status: "pending", dependeDe: ["a"] },
    ]);
    const a = layout.nos.find((n) => n.id === "a")!;
    const b = layout.nos.find((n) => n.id === "b")!;
    expect(a.x).toBe(0);
    expect(b.x).toBe(LARGURA_NO + 88);
    expect(layout.arestas).toEqual([{ deId: "a", paraId: "b" }]);
  });

  it("usa o nível mais profundo quando uma etapa depende de duas outras em níveis diferentes", () => {
    // a -> b -> c, e c também depende de a diretamente — c precisa ficar
    // depois de b (nível mais fundo), não só depois de a.
    const layout = calcularLayoutDoCanvas([
      { id: "a", agente: "estrategia", tarefa: "t1", status: "completed", dependeDe: [] },
      { id: "b", agente: "estrategia", tarefa: "t2", status: "completed", dependeDe: ["a"] },
      { id: "c", agente: "analitico", tarefa: "t3", status: "pending", dependeDe: ["a", "b"] },
    ]);
    const a = layout.nos.find((n) => n.id === "a")!;
    const b = layout.nos.find((n) => n.id === "b")!;
    const c = layout.nos.find((n) => n.id === "c")!;
    expect(a.x).toBe(0);
    expect(b.x).toBe(LARGURA_NO + 88);
    expect(c.x).toBe(2 * (LARGURA_NO + 88));
  });

  it("empilha etapas do mesmo nível em y diferentes, sem sobrepor", () => {
    const layout = calcularLayoutDoCanvas([
      { id: "a", agente: "design", tarefa: "t1", status: "pending", dependeDe: [] },
      { id: "b", agente: "video", tarefa: "t2", status: "pending", dependeDe: [] },
    ]);
    const ys = layout.nos.map((n) => n.y).sort((x, y) => x - y);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(ALTURA_NO);
  });

  it("nunca trava em ciclo (defensivo — não deveria acontecer em dado real)", () => {
    const layout = calcularLayoutDoCanvas([
      { id: "a", agente: "estrategia", tarefa: "t1", status: "pending", dependeDe: ["b"] },
      { id: "b", agente: "estrategia", tarefa: "t2", status: "pending", dependeDe: ["a"] },
    ]);
    expect(layout.nos).toHaveLength(2);
  });

  it("ignora depende_de que aponta pra um id fora do conjunto de etapas", () => {
    const layout = calcularLayoutDoCanvas([
      { id: "a", agente: "estrategia", tarefa: "t1", status: "pending", dependeDe: ["id-que-nao-existe"] },
    ]);
    expect(layout.nos[0].x).toBe(0);
    expect(layout.nos[0].dependeDe).toEqual([]);
  });
});
