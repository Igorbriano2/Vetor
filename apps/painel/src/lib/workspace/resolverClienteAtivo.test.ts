import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Primeiro teste do repo que passa um Supabase client fake — nenhum dos
// outros 47 arquivos de teste (ver docs/DESIGN-V2-PHASE-9-10-REPORT.md,
// investigação da Fase 9/10) toca Supabase, porque db/supabase.ts embrulha
// o client real num Proxy sem seam de injeção. resolverClienteAtivo()
// recebe o client como parâmetro (não importa o singleton), então dá pra
// testar a lógica real de decisão (papel/cookie/existência) sem Supabase
// de verdade — só os métodos que a função realmente chama.
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { resolverClienteAtivo, COOKIE_WORKSPACE } from "./resolverClienteAtivo";

interface UsuarioFake {
  nome: string;
  papel: "cliente" | "admin_vetor";
  cliente_id: string | null;
}

function criarSupabaseFake(config: {
  userId: string | null;
  usuarios?: Record<string, UsuarioFake>;
  clientesExistentes?: Record<string, string>; // id -> nome_empresa
}): SupabaseClient {
  const usuarios = config.usuarios ?? {};
  const clientes = config.clientesExistentes ?? {};

  return {
    auth: {
      getUser: async () => ({ data: { user: config.userId ? { id: config.userId } : null } }),
    },
    from(table: string) {
      return {
        select(cols: string) {
          return {
            eq(_col: string, val: string) {
              return {
                maybeSingle: async () => {
                  if (table === "usuarios") return { data: usuarios[val] ?? null };
                  if (table === "clientes") {
                    const nome = clientes[val];
                    if (nome === undefined) return { data: null };
                    // .select("id") (checagem de existência) vs
                    // .select("nome_empresa") (busca do nome real) — a
                    // função real chama os dois, com colunas diferentes.
                    return { data: cols.includes("nome_empresa") ? { nome_empresa: nome } : { id: val } };
                  }
                  return { data: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function mockCookie(valor: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (nome: string) => (nome === COOKIE_WORKSPACE && valor ? { name: nome, value: valor } : undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("resolverClienteAtivo", () => {
  it("sem usuário autenticado, devolve tudo nulo/false — nunca inventa um workspace", async () => {
    const supabase = criarSupabaseFake({ userId: null });
    const resultado = await resolverClienteAtivo(supabase);
    expect(resultado).toEqual({ clienteId: null, clienteNome: null, usuarioNome: null, ehAdmin: false });
  });

  it("usuário autenticado sem linha em 'usuarios' (órfão), devolve tudo nulo/false", async () => {
    const supabase = criarSupabaseFake({ userId: "user-fantasma" });
    const resultado = await resolverClienteAtivo(supabase);
    expect(resultado).toEqual({ clienteId: null, clienteNome: null, usuarioNome: null, ehAdmin: false });
  });

  it("cliente comum (não admin) sempre usa o próprio cliente_id, mesmo com cookie de outro workspace setado", async () => {
    mockCookie("cliente-outro-tenant");
    const supabase = criarSupabaseFake({
      userId: "user-1",
      usuarios: { "user-1": { nome: "Ana", papel: "cliente", cliente_id: "cliente-dono" } },
      clientesExistentes: { "cliente-dono": "Dog King", "cliente-outro-tenant": "Cantina da Ana" },
    });
    const resultado = await resolverClienteAtivo(supabase);
    // Isolamento de workspace (critério 15 da Fase 10) — cliente comum
    // NUNCA troca de workspace via cookie, mesmo que o cookie aponte pra
    // um tenant real e existente.
    expect(resultado.clienteId).toBe("cliente-dono");
    expect(resultado.clienteNome).toBe("Dog King");
    expect(resultado.ehAdmin).toBe(false);
  });

  it("admin sem cookie usa o próprio cliente_id (pode ser nulo)", async () => {
    mockCookie(undefined);
    const supabase = criarSupabaseFake({
      userId: "admin-1",
      usuarios: { "admin-1": { nome: "Suporte Vetor", papel: "admin_vetor", cliente_id: null } },
    });
    const resultado = await resolverClienteAtivo(supabase);
    expect(resultado.clienteId).toBeNull();
    expect(resultado.ehAdmin).toBe(true);
  });

  it("admin com cookie apontando pra um cliente real troca de workspace", async () => {
    mockCookie("cliente-dog-king");
    const supabase = criarSupabaseFake({
      userId: "admin-1",
      usuarios: { "admin-1": { nome: "Suporte Vetor", papel: "admin_vetor", cliente_id: null } },
      clientesExistentes: { "cliente-dog-king": "Dog King" },
    });
    const resultado = await resolverClienteAtivo(supabase);
    expect(resultado.clienteId).toBe("cliente-dog-king");
    expect(resultado.clienteNome).toBe("Dog King");
  });

  it("admin com cookie apontando pra um cliente que não existe mais nunca confia cegamente — ignora o cookie", async () => {
    mockCookie("cliente-apagado");
    const supabase = criarSupabaseFake({
      userId: "admin-1",
      usuarios: { "admin-1": { nome: "Suporte Vetor", papel: "admin_vetor", cliente_id: "cliente-padrao-do-admin" } },
      clientesExistentes: { "cliente-padrao-do-admin": "Workspace padrão" },
      // "cliente-apagado" propositalmente ausente de clientesExistentes.
    });
    const resultado = await resolverClienteAtivo(supabase);
    expect(resultado.clienteId).toBe("cliente-padrao-do-admin");
    expect(resultado.clienteNome).toBe("Workspace padrão");
  });
});
