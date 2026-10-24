import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "DDoS Atlas",
  description:
    "Explore country-level HTTP DDoS routes observed in recent Cloudflare Radar snapshots.",
}

export const viewport: Viewport = {
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased font-sans">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
