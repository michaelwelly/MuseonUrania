import type { Product } from "@/lib/api";
import { site } from "@/content/site";
import { publicSite } from "@/lib/seo";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

type Breadcrumb = {
  label: string;
  href?: string;
};

const context = "https://schema.org";

function absoluteUrl(value: string): string {
  if (/^https?:\/\//.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${publicSite}${path}`;
}

function json(data: JsonValue): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ id, data }: { id: string; data: JsonValue }) {
  // Структурированные данные нужны только на боевом домене. На стенде
  // publicSite пустой, и отдавать schema.org с адресом IP-стенда нельзя по
  // той же причине, по которой sitemap там пустой.
  if (!publicSite) return null;

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json(data) }}
    />
  );
}

export function organizationStructuredData(): JsonValue {
  return {
    "@context": context,
    "@type": "Organization",
    "@id": `${publicSite}/#organization`,
    name: site.legalName,
    alternateName: site.brand,
    url: publicSite,
    logo: absoluteUrl(site.logo.src),
    email: site.email,
    telephone: site.phone,
    address: {
      "@type": "PostalAddress",
      addressCountry: "RU",
      addressRegion: "Свердловская область",
      addressLocality: "Екатеринбург",
      streetAddress: "ул. Совхозная, стр. 20В",
      postalCode: "620135",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: site.phone,
      email: site.email,
      areaServed: "RU",
      availableLanguage: "ru",
    },
  };
}

export function websiteStructuredData(): JsonValue {
  return {
    "@context": context,
    "@type": "WebSite",
    "@id": `${publicSite}/#website`,
    name: site.brand,
    url: publicSite,
    inLanguage: "ru-RU",
    publisher: { "@id": `${publicSite}/#organization` },
  };
}

export function breadcrumbStructuredData(crumbs: Breadcrumb[], currentPath: string): JsonValue {
  return {
    "@context": context,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.href ?? currentPath),
    })),
  };
}

export function productStructuredData(product: Product, imageUrl?: string): JsonValue {
  return {
    "@context": context,
    "@type": "Product",
    "@id": `${absoluteUrl(`/products/${product.slug}/`)}#product`,
    name: product.name,
    description: product.detail ?? product.summary,
    category: product.categories.join(", "),
    image: imageUrl ? [absoluteUrl(imageUrl)] : undefined,
    brand: {
      "@type": "Brand",
      name: site.brand,
    },
    manufacturer: { "@id": `${publicSite}/#organization` },
    url: absoluteUrl(`/products/${product.slug}/`),
  };
}

export function articleStructuredData({
  path,
  title,
  description,
  publishedTime,
  imageUrl,
}: {
  path: string;
  title: string;
  description: string;
  publishedTime: string;
  imageUrl?: string;
}): JsonValue {
  return {
    "@context": context,
    "@type": "NewsArticle",
    "@id": `${absoluteUrl(path)}#article`,
    headline: title,
    description,
    datePublished: publishedTime,
    dateModified: publishedTime,
    inLanguage: "ru-RU",
    image: imageUrl ? [absoluteUrl(imageUrl)] : undefined,
    mainEntityOfPage: absoluteUrl(path),
    publisher: { "@id": `${publicSite}/#organization` },
  };
}
