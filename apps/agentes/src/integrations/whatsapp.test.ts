import { describe, it, expect } from "vitest";
import { extrairMensagens, extrairMensagensDeAudio } from "./whatsapp.js";

describe("extrairMensagens", () => {
  it("extrai mensagens de texto de um payload valido da Meta Cloud API", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "5511999999999", type: "text", text: { body: "oi" } },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(extrairMensagens(payload)).toEqual([{ numero: "5511999999999", texto: "oi" }]);
  });

  it("ignora mensagens que nao sao de texto", () => {
    const payload = {
      entry: [
        { changes: [{ value: { messages: [{ from: "1", type: "image" }] } }] },
      ],
    };

    expect(extrairMensagens(payload)).toEqual([]);
  });

  it("retorna lista vazia para payload sem entry", () => {
    expect(extrairMensagens({})).toEqual([]);
  });
});

describe("extrairMensagensDeAudio", () => {
  it("extrai mensagens de audio com o media id", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "5511999999999", type: "audio", audio: { id: "media-123", mime_type: "audio/ogg" } },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(extrairMensagensDeAudio(payload)).toEqual([
      { numero: "5511999999999", mediaId: "media-123" },
    ]);
  });

  it("ignora mensagens de audio sem media id", () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ from: "1", type: "audio", audio: {} }] } }] }],
    };

    expect(extrairMensagensDeAudio(payload)).toEqual([]);
  });

  it("nao mistura texto com audio", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "1", type: "text", text: { body: "oi" } },
                  { from: "2", type: "audio", audio: { id: "media-456" } },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(extrairMensagens(payload)).toEqual([{ numero: "1", texto: "oi" }]);
    expect(extrairMensagensDeAudio(payload)).toEqual([{ numero: "2", mediaId: "media-456" }]);
  });
});
