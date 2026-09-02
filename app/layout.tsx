import type { Metadata } from "next";

import "./globals.css";

const title = "優待クロス 手数料シミュレーター";
const description =
  "SMBC日興証券・楽天証券・SBI証券・三菱UFJ eスマート証券の優待クロスコストを比較できる計算機です。";
const siteOrigin = new URL("https://yutai-cross-calculator.workspace-843878.chatgpt.site");
const socialImage = new URL("/og.png", siteOrigin).toString();

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title,
  description,
  applicationName: "優待クロス計算機",
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
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
