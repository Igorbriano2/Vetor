import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Fase 2 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md, decisão #2)
// — primeiro endpoint de upload server-side do painel. Todo upload que já
// existia (Referências, Videomaker, Banco de imagens) ia direto do client
// React pro Supabase Storage, sem validação server-side de MIME/tamanho.
// Este endpoint reaproveita o MESMO bucket/tabela (brand-assets/
// business_assets) — nunca um segundo sistema de storage paralelo — só
// adiciona a validação que faltava, pra servir de destino seguro pros
// anexos de chat (que vêm de um contexto mais aberto: qualquer arquivo que
// o cliente arrastar, não uma tela de cadastro dedicada).

const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20MB — generoso o bastante pra imagem/PDF, curto o bastante pra nunca travar o upload no chat.

const MIME_PERMITIDOS: Record<string, { tipoAtivo: string; categoria: string }> = {
  "image/png": { tipoAtivo: "image", categoria: "campanhas_referencias" },
  "image/jpeg": { tipoAtivo: "image", categoria: "campanhas_referencias" },
  "image/webp": { tipoAtivo: "image", categoria: "campanhas_referencias" },
  "image/gif": { tipoAtivo: "image", categoria: "campanhas_referencias" },
  "video/mp4": { tipoAtivo: "video", categoria: "campanhas_referencias" },
  "video/webm": { tipoAtivo: "video", categoria: "campanhas_referencias" },
  "video/quicktime": { tipoAtivo: "video", categoria: "campanhas_referencias" },
  "application/pdf": { tipoAtivo: "document", categoria: "documentos_contexto" },
  "application/msword": { tipoAtivo: "document", categoria: "documentos_contexto" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { tipoAtivo: "document", categoria: "documentos_contexto" },
  "text/plain": { tipoAtivo: "document", categoria: "documentos_contexto" },
};

function sanitizarNomeArquivo(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
  if (!usuario?.cliente_id) {
    return NextResponse.json({ error: "Seu usuário ainda não está vinculado a um cliente" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const arquivo = formData?.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: `Arquivo maior que ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB` }, { status: 413 });
  }

  // Allowlist real de MIME — nunca confia na extensão do nome do arquivo
  // (spoofing trivial), só no Content-Type que o próprio File já resolveu.
  const regra = MIME_PERMITIDOS[arquivo.type];
  if (!regra) {
    return NextResponse.json({ error: `Tipo de arquivo não suportado: ${arquivo.type || "desconhecido"}` }, { status: 415 });
  }

  const nomeSanitizado = sanitizarNomeArquivo(arquivo.name || "arquivo");
  const storagePath = `${usuario.cliente_id}/chat/${randomUUID()}-${nomeSanitizado}`;

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const { error: erroUpload } = await supabase.storage.from("brand-assets").upload(storagePath, bytes, {
    contentType: arquivo.type,
    upsert: false,
  });
  if (erroUpload) {
    console.error("Erro ao subir anexo de chat:", erroUpload);
    return NextResponse.json({ error: "Falha ao salvar o arquivo" }, { status: 502 });
  }

  const { data: registrado, error: erroInsert } = await supabase
    .from("business_assets")
    .insert({
      cliente_id: usuario.cliente_id,
      storage_path: storagePath,
      nome: arquivo.name || nomeSanitizado,
      mime_type: arquivo.type,
      size_bytes: arquivo.size,
      tipo_ativo: regra.tipoAtivo,
      categoria: regra.categoria,
      origem: "upload_cliente",
      origem_chat: true,
      status: "aprovado",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (erroInsert || !registrado) {
    console.error("Erro ao registrar anexo de chat:", erroInsert);
    // Storage já recebeu o arquivo mas o registro falhou — melhor limpar
    // o órfão do que deixar um arquivo no bucket sem nenhuma linha
    // referenciando (nunca custa mais que a chamada de delete em si).
    await supabase.storage.from("brand-assets").remove([storagePath]);
    return NextResponse.json({ error: "Falha ao registrar o arquivo" }, { status: 502 });
  }

  const { data: assinada } = await supabase.storage.from("brand-assets").createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({
    assetId: registrado.id as string,
    nome: arquivo.name || nomeSanitizado,
    mimeType: arquivo.type,
    url: assinada?.signedUrl ?? null,
  });
}
