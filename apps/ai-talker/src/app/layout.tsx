import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "AI Talker | Next-Gen Language Learning",
    description: "Immersive English Learning with Gemini 2.5 Pro",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark h-full" suppressHydrationWarning>
            <body className={`${outfit.className} h-full bg-black overflow-hidden antialiased selection:bg-indigo-500/30`}>
                {children}
            </body>
        </html>
    );
}
