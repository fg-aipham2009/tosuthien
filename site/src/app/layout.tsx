import type { Metadata } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro } from "next/font/google";
import { Mp3PlayerShell } from "../components/library/Mp3PlayerShell";
import { JsonLd } from "../components/JsonLd";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import {
  DEFAULT_OG_IMAGE,
  HOME_SEO_TITLE,
  PWA_APP_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SITE_KEYWORDS,
  SCHEMA_ALTERNATE_NAMES,
  SEO_PRIMARY_KEYWORD,
  YOAST_ROBOTS,
  absoluteUrl,
} from "../lib/seo";
import "./globals.css";

const body = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_SEO_TITLE,
    template: `${SEO_PRIMARY_KEYWORD} | %s`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#612200" },
    { media: "(prefers-color-scheme: dark)", color: "#612200" },
  ],
  appleWebApp: {
    capable: true,
    title: PWA_APP_NAME,
    statusBarStyle: "default",
  },
  applicationName: PWA_APP_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { telephone: true, email: true, address: true },
  robots: YOAST_ROBOTS,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/wp/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/wp/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/wp/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/wp/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/wp/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico", "/wp/favicon-32.png"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/wp/apple-touch-icon.png", sizes: "180x180" },
    ],
    other: [{ rel: "msapplication-TileImage", url: "/wp/tile-270.png" }],
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: HOME_SEO_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_SEO_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: "BdPemL7FyMbeOt8Rudrs7X8LqRZwZ-_rFPpY_qpxJaU",
  },
  other: {
    "msapplication-TileImage": "/wp/tile-270.png",
  },
};

const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: [...SCHEMA_ALTERNATE_NAMES],
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "vi",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: [...SCHEMA_ALTERNATE_NAMES],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#/schema/logo/image/`,
        url: absoluteUrl("/wp/header-right.png"),
        contentUrl: absoluteUrl("/wp/header-right.png"),
        width: 512,
        height: 512,
        caption: SITE_NAME,
      },
      image: { "@id": `${SITE_URL}/#/schema/logo/image/` },
      email: "thoaidau1980@gmail.com",
      telephone: "+84908400155",
      address: {
        "@type": "PostalAddress",
        streetAddress: "B15/20, Quốc Lộ 50, xã Bình Hưng",
        addressLocality: "TP.HCM",
        addressCountry: "VN",
      },
      sameAs: [
        "https://www.youtube.com/c/TôngPhongTổSưThiền",
        "https://www.tiktok.com/@tongphongtosuthien",
        "https://www.facebook.com/Nhohoivanhin/",
        "https://tosuthien.net/",
      ],
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#pwa`,
      name: PWA_APP_NAME,
      url: SITE_URL,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <JsonLd data={siteGraph} />
        <Mp3PlayerShell>
          <SiteHeader />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <SiteFooter />
        </Mp3PlayerShell>
        <Script src="/pwa-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
