import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // アプリのようにズーム固定（リーダー内部制御に任せる）
};

export const metadata: Metadata = {
  title: "My Kindle",
  description: "Personal Self-Hosted Manga Reader",
  manifest: "/manifest.json", // マニフェストへのリンク
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyKindle",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
