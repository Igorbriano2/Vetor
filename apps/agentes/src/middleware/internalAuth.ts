import type { Request, Response, NextFunction } from "express";

// Autenticação simples entre serviços internos (painel -> agentes), não exposta
// ao navegador. Extraído de routes/plataforma.ts para ser reaproveitado por
// routes/missoes.ts sem duplicar a checagem.
export function autenticado(req: Request): boolean {
  const esperado = process.env.INTERNAL_API_TOKEN;
  return !!esperado && req.header("x-internal-token") === esperado;
}

export function exigirAuthInterna(req: Request, res: Response, next: NextFunction): void {
  if (!autenticado(req)) {
    res.sendStatus(401);
    return;
  }
  next();
}
