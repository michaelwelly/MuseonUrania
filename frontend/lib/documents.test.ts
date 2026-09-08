import { describe, expect, it } from "vitest";
import type { Doc } from "@/lib/api";
import {
  REQUEST_HREF,
  accessBadge,
  actionLabel,
  docHref,
  docNote,
  forProduct,
  isOpen,
  linkTarget,
} from "@/lib/documents";

// Правило ссылки на документ. Issue #73.
//
// Проверяется то, что ломается молча и дорого: кнопка, обещающая файл,
// которого нет. Сама по себе она не падает и не пишет в журнал — посетитель
// просто получает 404 вместо документа и уходит.

const doc = (over: Partial<Doc> = {}): Doc => ({
  slug: "opisanie-izdeliya-vedal-r1-r2",
  title: "Описание изделия",
  group: "Техническая документация",
  product: "VEDAL R1, R2",
  productSlug: "vedal-r1",
  access: "Файл",
  published: false,
  ...over,
});

const открытый = doc({
  published: true,
  file: "http://portal/api/public/v1/documents/opisanie-izdeliya-vedal-r1-r2/file",
});

describe("правило ссылки на документ", () => {
  it("есть файл — ведём на файл", () => {
    expect(isOpen(открытый)).toBe(true);
    expect(docHref(открытый)).toBe(открытый.file);
  });

  it("нет файла — ведём на форму запроса, а не в пустоту", () => {
    expect(docHref(doc())).toBe(REQUEST_HREF);
  });

  // Отдельный случай, и он не теоретический: published приходит из портала
  // раньше, чем файл попадает в бакет. Одного флага мало.
  it("опубликован, но файла нет — это закрытый документ", () => {
    expect(isOpen(doc({ published: true }))).toBe(false);
    expect(docHref(doc({ published: true }))).toBe(REQUEST_HREF);
  });

  it("файл есть, но публикации нет — тоже закрытый", () => {
    expect(isOpen(doc({ file: "http://portal/file" }))).toBe(false);
  });

  it("новая вкладка и rel — только у открываемых", () => {
    expect(linkTarget(открытый)).toEqual({ target: "_blank", rel: "noopener" });
    expect(linkTarget(doc())).toEqual({});
  });
});

describe("бейдж доступа", () => {
  it("выложенный файл называется файлом", () => {
    expect(accessBadge(открытый)).toBe("Файл");
  });

  // Ровно та ложь, из-за которой заведён issue: строка с намерением
  // выложить PDF, но без файла, обещала скачивание.
  it("намерение выложить файл без файла не обещает скачивание", () => {
    expect(accessBadge(doc({ access: "Файл" }))).toBe("По запросу");
  });

  it("«Уточняется» остаётся: это статус документа, а не файла", () => {
    expect(accessBadge(doc({ access: "Уточняется" }))).toBe("Уточняется");
  });

  it("действие называется словом", () => {
    expect(actionLabel(открытый)).toBe("Открыть");
    expect(actionLabel(doc())).toBe("Запросить");
  });

  it("подпись говорит, что будет по нажатию", () => {
    expect(docNote(открытый)).toContain("открывается в новой вкладке");
    expect(docNote(doc())).toContain("выдаётся по запросу");
    expect(docNote(doc({ access: "Уточняется" }))).toContain("согласуется");
  });
});

describe("документы изделия", () => {
  const перечень = [
    doc({ slug: "opisanie-r1", productSlug: "vedal-r1" }),
    doc({ slug: "ru-r2", productSlug: "vedal-r2" }),
    doc({ slug: "licenziya", productSlug: null }),
  ];

  it("берутся по связи портала, а не по подписи", () => {
    expect(forProduct(перечень, "vedal-r1").map((d) => d.slug)).toEqual(["opisanie-r1"]);
  });

  // Подпись «VEDAL R1, R2» относится к строке, привязанной к vedal-r1.
  // Разбирать её текстом значит показать на карточке R2 документ, которого
  // у R2 может не быть (V27, §2).
  it("подпись с двумя изделиями не притягивает строку к соседу", () => {
    expect(forProduct(перечень, "vedal-r2").map((d) => d.slug)).toEqual(["ru-r2"]);
  });

  it("документы компании к изделию не приписываются", () => {
    expect(forProduct(перечень, "vedal-t-100")).toEqual([]);
  });
});
