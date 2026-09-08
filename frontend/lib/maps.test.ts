import { describe, expect, it } from "vitest";
import { route } from "@/content/contacts";
import { site } from "@/content/site";
import { mapEmbedSrc } from "./maps";

// Адрес кадра с картой. Issue #74.
//
// Ломается это молча и в одну сторону: карта показывает не тот дом, а понять
// это можно только глазами и только у того, кто знает правильный адрес.

describe("адрес встроенной карты", () => {
  it("собирается виджетом, которому не нужен ключ", () => {
    // Ключа API у проекта нет, и выдумать его нельзя. Из трёх способов
    // встроить Яндекс.Карты без ключа работает один — map-widget.
    expect(mapEmbedSrc("адрес")).toMatch(/^https:\/\/yandex\.ru\/map-widget\/v1\//);
  });

  it("кодирует адрес, а не подставляет его как есть", () => {
    // В адресе площадки есть запятые, пробелы и кириллица. Незакодированные,
    // они превратились бы в мусорный запрос и карту не туда.
    expect(mapEmbedSrc("ул. Совхозная, стр. 20В")).toContain(
      encodeURIComponent("ул. Совхозная, стр. 20В"),
    );
  });

  it("берёт адрес производства из site.address", () => {
    // Одно место на карту и на ссылку «Построить маршрут». Вторая строка
    // с адресом в разметке разъехалась бы с этой, и карта показывала бы
    // один дом, а маршрут вёл бы к другому.
    expect(route.mapSrc).toContain(encodeURIComponent(site.address));
    expect(route.ctaHref).toContain(encodeURIComponent(site.address));
  });
});
