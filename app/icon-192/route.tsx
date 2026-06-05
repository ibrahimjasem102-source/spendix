import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "linear-gradient(135deg, #06B6D4 0%, #7C3AED 100%)",
          borderRadius: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 96, fontWeight: 900, fontFamily: "sans-serif" }}>
          S
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
