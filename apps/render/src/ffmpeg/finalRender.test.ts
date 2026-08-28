import { describe, expect, it } from "vitest";
import { montarArgsFfmpegRenderFinal, montarArgsFfmpegConcatMultiClip, decomporSpeedEmCadeiaAtempo, montarFiltroFadeDeCorte } from "./finalRender.js";

describe("montarFiltroFadeDeCorte", () => {
  it("clipe normal: fade de 30ms em cada ponta", () => {
    const filtro = montarFiltroFadeDeCorte(4);
    expect(filtro).toBe("afade=t=in:st=0:d=0.030,afade=t=out:st=3.970:d=0.030");
  });

  it("clipe curtíssimo (menos de 60ms): encolhe o fade pra nunca ultrapassar metade da duração", () => {
    const filtro = montarFiltroFadeDeCorte(0.04);
    expect(filtro).toBe("afade=t=in:st=0:d=0.020,afade=t=out:st=0.020:d=0.020");
  });
});

describe("montarArgsFfmpegRenderFinal", () => {
  it("aplica trim (corte simples) via -ss/-t a partir do input original", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/original.mp4",
      outputPath: "/tmp/final.mp4",
      trimInMs: 1500,
      trimOutMs: 5500,
    });
    expect(args.slice(0, 3)).toEqual(["-y", "-i", "/tmp/original.mp4"]);
    expect(args[args.indexOf("-ss") + 1]).toBe("1.500");
    // duração = trimOut - trimIn = 4000ms = 4.000s
    expect(args[args.indexOf("-t") + 1]).toBe("4.000");
    expect(args[args.length - 1]).toBe("/tmp/final.mp4");
  });

  it("sem legendas, nunca inclui o filtro subtitles", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
    });
    expect(args).not.toContain("-vf");
  });

  it("com legendas, aplica o filtro subtitles com o caminho do .srt", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
      legendasSrtPath: "/tmp/legendas.srt",
    });
    expect(args).toContain("-vf");
    const filtro = args[args.indexOf("-vf") + 1]!;
    expect(filtro).toContain("subtitles=/tmp/legendas.srt");
    expect(filtro).toContain("force_style=");
  });

  it("escapa ':' no caminho do .srt (sintaxe do filtro subtitles usa ':' como separador de opção)", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
      legendasSrtPath: "C:\\pasta\\legendas.srt",
    });
    expect(args[args.indexOf("-vf") + 1]).toContain("subtitles=C\\:\\\\pasta\\\\legendas.srt");
  });

  it("sempre reencoda em libx264/aac com faststart (entregável final, nunca stream-copy)", () => {
    const args = montarArgsFfmpegRenderFinal({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      trimInMs: 0,
      trimOutMs: 1000,
    });
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args).toContain("+faststart");
  });
});

describe("decomporSpeedEmCadeiaAtempo", () => {
  it("speed dentro do intervalo suportado vira um único atempo", () => {
    expect(decomporSpeedEmCadeiaAtempo(1.5)).toEqual(["atempo=1.5000"]);
    expect(decomporSpeedEmCadeiaAtempo(0.5)).toEqual(["atempo=0.5000"]);
    expect(decomporSpeedEmCadeiaAtempo(2)).toEqual(["atempo=2.0000"]);
  });

  it("speed acima de 2x encadeia múltiplos atempo (produto = speed pedido)", () => {
    const cadeia = decomporSpeedEmCadeiaAtempo(3);
    const produto = cadeia.reduce((acc, f) => acc * Number(f.split("=")[1]), 1);
    expect(produto).toBeCloseTo(3, 3);
    expect(cadeia.every((f) => Number(f.split("=")[1]) <= 2)).toBe(true);
  });

  it("speed abaixo de 0.5x (câmera lenta extrema) também encadeia (produto = speed pedido)", () => {
    const cadeia = decomporSpeedEmCadeiaAtempo(0.25);
    const produto = cadeia.reduce((acc, f) => acc * Number(f.split("=")[1]), 1);
    expect(produto).toBeCloseTo(0.25, 3);
    expect(cadeia.every((f) => Number(f.split("=")[1]) >= 0.5)).toBe(true);
  });

  it("rejeita speed inválido (zero ou negativo) — nunca gera um atempo sem sentido", () => {
    expect(() => decomporSpeedEmCadeiaAtempo(0)).toThrow();
    expect(() => decomporSpeedEmCadeiaAtempo(-1)).toThrow();
  });
});

describe("montarArgsFfmpegConcatMultiClip", () => {
  const opcoesBase = { outputPath: "/tmp/final.mp4", width: 1080, height: 1920, fps: 30 };

  it("rejeita lista vazia de clipes — nunca monta um comando ffmpeg sem input", () => {
    expect(() => montarArgsFfmpegConcatMultiClip({ ...opcoesBase, clipes: [] })).toThrow();
  });

  it("um único clipe de vídeo: 1 input, filtro de trim+scale, concat=n=1", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [{ inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 500, trimOutMs: 3000, speed: 1, volume: 1 }],
    });
    expect(args.filter((a) => a === "-i")).toHaveLength(1);
    expect(args).toContain("/tmp/a.mp4");
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("trim=start=0.500:end=3.000");
    expect(filtro).toContain("concat=n=1:v=1:a=1[vout][aout]");
    expect(args).toContain("libx264");
  });

  it("dois clipes de vídeo: 2 inputs, cada um com seu próprio label, concat=n=2 encadeando os 4 labels", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [
        { inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 2000, speed: 1, volume: 1 },
        { inputPath: "/tmp/b.mp4", tipo: "video", trimInMs: 1000, trimOutMs: 4000, speed: 1, volume: 0.5 },
      ],
    });
    expect(args.filter((a) => a === "-i")).toHaveLength(2);
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout]");
    expect(filtro).toContain("volume=0.500");
  });

  it("todo clipe de vídeo tem fade de corte no áudio — nunca um estalo audível na emenda entre clipes", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [
        { inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 4000, speed: 1, volume: 1 },
        { inputPath: "/tmp/b.mp4", tipo: "video", trimInMs: 0, trimOutMs: 4000, speed: 1, volume: 1 },
      ],
    });
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect((filtro.match(/afade=t=in/g) ?? []).length).toBe(2);
    expect((filtro.match(/afade=t=out/g) ?? []).length).toBe(2);
  });

  it("fade de corte considera a duração PÓS-speed do áudio (clipe acelerado 2x fica com metade da duração)", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [{ inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 4000, speed: 2, volume: 1 }],
    });
    const filtro = args[args.indexOf("-filter_complex") + 1];
    // 4s de trim / 2x speed = 2s de áudio real — fade-out começa em 2-0.03=1.970
    expect(filtro).toContain("afade=t=out:st=1.970:d=0.030");
  });

  it("clipe com speed != 1 aplica setpts e atempo — nunca acelera o vídeo sem acelerar o áudio junto", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [{ inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 2000, speed: 2, volume: 1 }],
    });
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("setpts=(PTS-STARTPTS)/2");
    expect(filtro).toContain("atempo=2.0000");
  });

  it("clipe de imagem: -loop 1 -t <duração>, sem trim/atempo de vídeo, com silêncio gerado (anullsrc) no lugar do áudio", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [{ inputPath: "/tmp/foto.png", tipo: "image", trimInMs: 0, trimOutMs: 2500, speed: 1, volume: 1 }],
    });
    expect(args).toContain("-loop");
    expect(args[args.indexOf("-loop") + 1]).toBe("1");
    expect(args[args.indexOf("-t") + 1]).toBe("2.500");
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("anullsrc=channel_layout=stereo:sample_rate=44100:duration=2.500[a0]");
    expect(filtro).not.toContain("trim=start"); // imagem não tem trim de conteúdo, só duração via -t
  });

  it("com legendas, aplica subtitles depois do concat (sobre o resultado final, não por clipe)", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [{ inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 2000, speed: 1, volume: 1 }],
      legendasSrtPath: "/tmp/legendas.srt",
    });
    const filtro = args[args.indexOf("-filter_complex") + 1];
    expect(filtro).toContain("[vout]subtitles=/tmp/legendas.srt");
    expect(filtro).toContain("force_style=");
    expect(filtro).toContain("[vlegendado]");
    expect(args[args.indexOf("-map") + 1]).toBe("[vlegendado]");
  });

  it("todo clipe é forçado pro mesmo width/height/fps antes do concat (o filtro concat exige segmentos idênticos)", () => {
    const args = montarArgsFfmpegConcatMultiClip({
      ...opcoesBase,
      clipes: [
        { inputPath: "/tmp/a.mp4", tipo: "video", trimInMs: 0, trimOutMs: 1000, speed: 1, volume: 1 },
        { inputPath: "/tmp/foto.png", tipo: "image", trimInMs: 0, trimOutMs: 1000, speed: 1, volume: 1 },
      ],
    });
    const filtro = args[args.indexOf("-filter_complex") + 1];
    const ocorrencias = filtro.match(/scale=1080:1920/g) ?? [];
    expect(ocorrencias.length).toBe(2);
    expect(filtro).toContain("fps=30");
  });
});
