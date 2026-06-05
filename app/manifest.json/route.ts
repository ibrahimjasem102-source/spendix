import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      name: "Spendix",
      short_name: "Spendix",
      description:
        "Spendix is a modern personal finance app for tracking expenses, income, budgets, debts, investments, goals and work hours.",
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
      background_color: "#0B0F17",
      theme_color: "#0B0F17",
      orientation: "portrait",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
