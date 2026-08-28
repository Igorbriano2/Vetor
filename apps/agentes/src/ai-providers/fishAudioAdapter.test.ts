import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("../db/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
    }),
  },
}));

const { FishAudioAdapter, MODELO_FISHAUDIO_PADRAO } = await import("./fishAudioAdapter.js");

describe("FishAudioAdapter", () => {
  const modelo = MODELO_FISHAUDIO_PADRAO;
  const chaveOriginal = process.env.FISH_AUDIO_API_KEY;

  beforeEach(() => {
    process.env.FISH_AUDIO_API_KEY = "chave-teste";
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://storage.example/assinado.mp3" }, error: null });
    mockMaybeSingle.mockReset().mockResolvedValue({ data: null });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.FISH_AUDIO_API_KEY = chaveOriginal;
    vi.unstubAllGlobals();
  });

  it("generate sintetiza, sobe o áudio pro storage, e getJobStatus devolve 'done' com a URL real", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("audio-fake").buffer,
    });

    const adapter = new FishAudioAdapter();
    const { jobId } = await adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "Bem-vindo à loja" }, modelo);
    expect(mockUpload).toHaveBeenCalledTimes(1);

    const status = await adapter.getJobStatus(jobId);
    expect(status.status).toBe("done");
    expect(status.resultAssetUrls).toEqual(["https://storage.example/assinado.mp3"]);
  });

  it("generate sem roteiro lança erro claro, nunca chama o provider", async () => {
    const adapter = new FishAudioAdapter();
    await expect(adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "   " }, modelo)).rejects.toThrow(/Roteiro vazio/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resposta de erro do provider vira erro claro, nunca finge sucesso nem sobe nada", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "chave inválida",
    });
    const adapter = new FishAudioAdapter();
    await expect(adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "oi" }, modelo)).rejects.toThrow(/401/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("resolve o provider_voice_id da 1ª voz selecionada e manda como reference_id", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { provider_voice_id: "voz-real-123" } });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("audio-fake").buffer,
    });
    const adapter = new FishAudioAdapter();
    await adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "oi", extra: { voiceIds: ["voz-1"] } }, modelo);
    const chamada = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(chamada[1].body as string);
    expect(corpo.reference_id).toBe("voz-real-123");
  });

  it("sem voz selecionada, gera sem reference_id (voz padrão do provider) em vez de inventar uma", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("audio-fake").buffer,
    });
    const adapter = new FishAudioAdapter();
    await adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "oi" }, modelo);
    const chamada = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(chamada[1].body as string);
    expect(corpo.reference_id).toBeUndefined();
  });

  it("voz com provider_voice_id '__default__' (sentinela da voz padrão) também vai sem reference_id", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { provider_voice_id: "__default__" } });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("audio-fake").buffer,
    });
    const adapter = new FishAudioAdapter();
    await adapter.generate({ kind: "voice", modelId: modelo.id, prompt: "oi", extra: { voiceIds: ["fishaudio-padrao"] } }, modelo);
    const chamada = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(chamada[1].body as string);
    expect(corpo.reference_id).toBeUndefined();
  });

  it("getJobStatus com jobId inválido nunca finge sucesso — falha explícita", async () => {
    const adapter = new FishAudioAdapter();
    const status = await adapter.getJobStatus("nao-existe");
    expect(status.status).toBe("failed");
    expect(status.error).toBeTruthy();
  });
});
