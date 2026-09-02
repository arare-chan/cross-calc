import type { Metadata } from "next";
import { headers } from "next/headers";

import "./globals.css";

const title = "優待クロス 手数料シミュレーター";
const description =
  "SMBC日興証券・楽天証券・SBI証券・三菱UFJ eスマート証券の優待クロスコストを比較できる計算機です。";

function trustedOrigin(host: string | null): URL | null {
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return null;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  const trusted =
    hostname === "localhost" ||
    hostname.endsWith(".openai.site") ||
    hostname.endsWith(".sites.openai.com") ||
    hostname.endsWith(".chatgpt.com");
  if (!trusted) return null;
  return new URL(`${hostname === "localhost" ? "http" : "https"}://${host}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = trustedOrigin((await headers()).get("host"));
  const image = origin ? new URL("/og.png", origin).toString() : undefined;

  return {
    metadataBase: origin ?? undefined,
    title,
    description,
    applicationName: "優待クロス計算機",
    icons: { icon: "/favicon.svg" },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ja_JP",
      title,
      description,
      images: image ? [{ url: image, width: 1536, height: 1024, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
