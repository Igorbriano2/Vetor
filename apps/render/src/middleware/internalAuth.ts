import type { Request, Response, NextFunction } from "express";

// Autenticação entre serviços internos (agentes -> render), não exposta ao
// navegador. Mesmo padrão de apps/agentes/src/middleware/internalAuth.ts —
// mesmo INTERNAL_API_TOKEN configurado nos dois serviços.
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
