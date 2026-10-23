import type { Metadata } from "next";

import "./globals.css";

const title = "あられーたー";
const description =
  "SMBC日興証券・楽天証券・SBI証券・三菱UFJ eスマート証券の優待クロスコストを比較できる計算機です。";
const siteOrigin = new URL("https://yutai-cross-calculator.workspace-843878.chatgpt.site");
const socialImage = new URL("/og.png", siteOrigin).toString();

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title,
  description,
  applicationName: title,
  icons: {
    icon: [
      { url: "/favicon.ico?v=20261023", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-32x32.png?v=20261023", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=20261023", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png?v=20261023", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { title },
  manifest: "/site.webmanifest?v=20261023",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: title,
    url: siteOrigin,
    title,
    description,
    images: [{ url: socialImage, width: 1536, height: 1024, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
