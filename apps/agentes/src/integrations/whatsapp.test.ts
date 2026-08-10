import { describe, it, expect } from "vitest";
import { extrairMensagens } from "./whatsapp.js";

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
