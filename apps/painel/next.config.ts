import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mesmo problema/fix de apps/landing/next.config.ts: sem isso, react/react-dom
  // hoisted pro node_modules da raiz do workspace npm somem no runtime isolado
  // da DigitalOcean App Platform ("Cannot find module 'react'").
  output: "standalone",
};

export default nextConfig;
