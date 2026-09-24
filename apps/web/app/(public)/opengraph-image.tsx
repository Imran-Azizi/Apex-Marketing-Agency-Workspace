import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "شرکت تبلیغاتی اپیکس — ویدیو تبلیغاتی، برندینگ و بازاریابی";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(
    path.join(process.cwd(), "public/brand/apex-logo.png"),
  );
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b0b0d 0%, #1a1208 55%, #0b0b0d 100%)",
          color: "#f7f3ea",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            padding: "0 80px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={220} height={220} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: 2 }}>
              APEX
            </div>
            <div style={{ fontSize: 32, color: "#e7c27a", maxWidth: 640 }}>
              Advertising, branding and commercial video
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
