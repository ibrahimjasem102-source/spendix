import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#06B6D4",
          borderRadius: 112,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 256, fontWeight: 900, fontFamily: "sans-serif" }}>
          S
        </span>
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}

