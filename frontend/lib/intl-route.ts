import { notFound } from "next/navigation";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";

// Разбор сегмента `[lang]` для маршрутов `app/(intl)/[lang]/**`.
//
// Проверка обязательна, и вот почему. Динамический сегмент в корне ловит
// первый кусок любого адреса: `/foo/products/` для маршрутизатора выглядит
// как `lang=foo`. Статические маршруты (`/products/`, `/admin/`) он не
// перехватывает — Next разбирает их раньше, — но выдуманное имя языка
// доехало бы до страницы и отрисовало русский контент под чужим адресом.
//
// Отдельно отсекается `ru`: русская версия живёт в корне, и `/ru/products/`
// был бы её вторым адресом с тем же содержимым. Для поисковика это дубль,
// для человека — второй адрес, который надо где-то поддерживать.

export async function intlLang(params: Promise<{ lang: string }>): Promise<Lang> {
  const { lang } = await params;
  if (!isLang(lang) || lang === DEFAULT_LANG) notFound();
  return lang;
}
