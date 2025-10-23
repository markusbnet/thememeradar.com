import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Meme Radar - Track Meme Stock Trends from Reddit",
  description: "Monitor r/wallstreetbets and other communities to identify trending stocks with sentiment analysis",
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
