import type { Metadata, Viewport } from "next";
import { Barlow, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import "./globals.css";

const saira = Saira_Condensed({
  variable: "--font-saira",
  weight: ["500", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "CarSpotter",
  description: "Numără mașinile pe mărci: apeși pe marcă și crește numărul.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${saira.variable} ${barlow.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
