import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Instagram運用支援ツール",
  description: "工務店向けエリアマップ分析・投稿企画ツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="h-[calc(100vh-56px)]">{children}</main>
      </body>
    </html>
  );
}
