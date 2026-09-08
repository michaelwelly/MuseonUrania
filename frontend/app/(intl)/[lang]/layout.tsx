import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { ui } from "@/content/ui";
import { PREFIXED_LANGS } from "@/lib/i18n";
import { intlLang } from "@/lib/intl-route";
import { siteUrl } from "@/lib/seo";
import "../../globals.css";
import "../../motion.css";

// Переведённые версии сайта: `/en/...` и `/zh/...`.
//
// Свой корневой layout, а не вложенный в `app/(site)`: `<html lang>` обязан
// меняться вместе с языком, а поставить его может только корень. Подробно —
// в `components/SiteShell.tsx`.

/**
 * Никаких языков, кроме перечисленных.
 *
 * Без этого `/de/products/` собрался бы по запросу и отдал русское
 * содержимое под немецким адресом — поисковику это дубль, посетителю
 * обман. Список один и тот же и для сборки, и для проверки в `intlLang`.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata(props: LayoutProps<"/[lang]">): Promise<Metadata> {
  const lang = await intlLang(props.params);
  const strings = ui(lang);
  return {
    ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    title: strings.meta.siteTitle,
    description: strings.meta.siteDescription,
  };
}

export default async function IntlLayout(props: LayoutProps<"/[lang]">) {
  const lang = await intlLang(props.params);
  return <SiteShell lang={lang}>{props.children}</SiteShell>;
}
