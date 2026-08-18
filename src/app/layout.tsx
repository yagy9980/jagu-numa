import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ジャグ沼｜ジャグラー実戦データ分析・コミュニティ",
  description: "BIG・REG・合算を記録し、全国の実戦データと比べるジャグラー特化コミュニティ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09050d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
