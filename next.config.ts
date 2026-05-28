import type { NextConfig } from "next";

const enablePWA = process.env.ENABLE_PWA === "1";

// next-pwa ships as CJS; require() is the correct import in .ts configs
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development" || !enablePWA,
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk"],

  async headers() {
    return [
      {
        // HTML pages — never cache so phone always gets latest after vercel --prod
        source: "/((?!_next/static|_next/image|favicon|icons|images|manifest).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
