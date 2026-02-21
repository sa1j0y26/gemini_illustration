import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gemini Illustration Game",
  description: "最大4人でお題を描き、AIに当てさせるリアルタイム対戦ゲーム"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
