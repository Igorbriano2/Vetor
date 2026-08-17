import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DigitalOcean App Platform só deployeia o conteúdo de source_dir (apps/landing),
  // não o monorepo inteiro — sem isso, react/react-dom hoisted pro node_modules
  // da raiz do workspace npm somem em runtime ("Cannot find module 'react'"),
  // mesmo com o build passando local. standalone traça as deps de verdade
  // usadas e copia tudo pra dentro de .next/standalone, self-contained.
  output: "standalone",
};

export default nextConfig;
