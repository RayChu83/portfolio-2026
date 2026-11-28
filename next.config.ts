import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: { "/api/ask": ["./rag/**/*.md"] },
};

export default nextConfig;
