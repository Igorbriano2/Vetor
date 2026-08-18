import { describe, expect, it } from "vitest";
import { extensaoParaTranscricao } from "./transcricao.js";

describe("extensaoParaTranscricao", () => {
  it("reconhece webm (MediaRecorder do navegador — assistente de voz)", () => {
    expect(extensaoParaTranscricao("audio/webm;codecs=opus")).toBe("webm");
    expect(extensaoParaTranscricao("audio/webm")).toBe("webm");
  });

  it("reconhece ogg (áudio de voz do WhatsApp)", () => {
    expect(extensaoParaTranscricao("audio/ogg; codecs=opus")).toBe("ogg");
  });

  it("reconhece mp4, mp3/mpeg, wav, m4a, flac", () => {
    expect(extensaoParaTranscricao("audio/mp4")).toBe("mp4");
    expect(extensaoParaTranscricao("audio/mpeg")).toBe("mp3");
    expect(extensaoParaTranscricao("audio/mp3")).toBe("mp3");
    expect(extensaoParaTranscricao("audio/wav")).toBe("wav");
    expect(extensaoParaTranscricao("audio/m4a")).toBe("m4a");
    expect(extensaoParaTranscricao("audio/flac")).toBe("flac");
  });

  it("nunca cai em 'bin' — mime type desconhecido usa webm como melhor chute, nunca um formato que a OpenAI rejeita", () => {
    expect(extensaoParaTranscricao("application/octet-stream")).toBe("webm");
    expect(extensaoParaTranscricao("")).toBe("webm");
  });
});
