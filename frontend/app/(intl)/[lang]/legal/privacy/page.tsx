import type { Metadata } from "next";
import PrivacyScreen, { privacyMetadata } from "@/app/(site)/legal/privacy/screen";
import { intlLang } from "@/lib/intl-route";

// Политика персональных данных на английском и китайском:
// `/en/legal/privacy/`, `/zh/legal/privacy/`.
//
// Маршрут существует не ради перевода — переводить юридический текст мы
// не вправе, — а ради ссылки: политика стоит в подвале каждой страницы,
// и на переведённой версии эта ссылка обязана вести на адрес того же языка,
// а не выбрасывать посетителя в русский корень. Сам документ на этих
// адресах остаётся русским, о чём и говорит примечание на странице.

export async function generateMetadata(
  props: PageProps<"/[lang]/legal/privacy">,
): Promise<Metadata> {
  return privacyMetadata(await intlLang(props.params));
}

export default async function LocalizedPrivacy(props: PageProps<"/[lang]/legal/privacy">) {
  return <PrivacyScreen lang={await intlLang(props.params)} />;
}
