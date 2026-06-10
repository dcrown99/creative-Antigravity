import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@repo/ui";
import { Toaster } from "sonner";
import "@repo/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "News Widget | AI News Reader",
    description: "Zero-latency AI news reader powered by Gemini",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                    <Toaster richColors position="bottom-right" />
                </ThemeProvider>
            </body>
        </html>
    );
}
