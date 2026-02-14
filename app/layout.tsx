import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Smart Bookmark App",
    description: "A modern bookmark manager with real-time updates",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
