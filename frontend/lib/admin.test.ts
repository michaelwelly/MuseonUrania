import { describe, expect, it, vi } from "vitest";

const BASE = "https://portal.test";

// Отказ портала, разобранный клиентом. Локальный тип, чтобы не тащить класс
// из динамического импорта туда, где он нужен только как тип.
type Refusal = { status: number; message: string; fields?: Record<string, string> };

async function admin(token: string | null = "token-1") {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
  vi.resetModules();
  // Вход подменяется целиком: этот набор про разбор ответов портала,
  // а не про PKCE.
  vi.doMock("./auth", () => ({ accessToken: async () => token }));
  return import("./admin");
}

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("клиент админского API", () => {
  it("прикладывает токен и не выдумывает Content-Type для файлов", async () => {
    const { products, uploadMedia } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchMock);

    await products();
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-1");

    // Границу multipart проставляет браузер вместе с заголовком. Подставить
    // Content-Type руками значит отправить тело, которое сервер не разберёт.
    await uploadMedia(new File(["x"], "photo.jpg"), "products", "vedal-r1-r2");
    const uploadHeaders = fetchMock.mock.calls[1][1].headers as Headers;
    expect(uploadHeaders.get("Content-Type")).toBeNull();
    expect(uploadHeaders.get("Authorization")).toBe("Bearer token-1");
  });

  it("без входа не ходит в портал вовсе", async () => {
    const { products, AdminError } = await admin(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(products()).rejects.toBeInstanceOf(AdminError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Портал отвечает problem+json, и разбор по полям — это то, ради чего
  // форма показывает ошибку рядом с полем, а не строкой сверху.
  it("разбирает problem+json с полями формы", async () => {
    const { createProduct, AdminError } = await admin();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json(
          {
            title: "Проверьте заполнение полей",
            status: 400,
            fields: { slug: "Только латиница в нижнем регистре, цифры и дефис" },
          },
          400,
        ),
      ),
    );

    const failure = await createProduct({} as never).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(AdminError);
    expect((failure as Refusal).status).toBe(400);
    expect((failure as Refusal).message).toBe("Проверьте заполнение полей");
    expect((failure as Refusal).fields?.slug).toContain("латиница");
  });

  // Отказ по версии приходит как 409 с объяснением. Проглотить его —
  // значит показать редактору успех там, где правка не сохранилась.
  it("доносит отказ по версии как есть", async () => {
    const { updateProduct } = await admin();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({ title: "Изделие уже изменил другой редактор", status: 409 }, 409),
      ),
    );

    const failure = (await updateProduct("id-1", {} as never).catch(
      (e: unknown) => e,
    )) as Refusal;

    expect(failure.status).toBe(409);
    expect(failure.message).toContain("другой редактор");
  });

  it("ответ не в problem+json не роняет разбор", async () => {
    const { products } = await admin();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("это html от прокси, а не json");
        },
      } as unknown as Response),
    );

    const failure = (await products().catch((e: unknown) => e)) as Refusal;

    expect(failure.status).toBe(502);
    expect(failure.message).toContain("502");
  });

  it("недоступный портал отличается от отказа портала", async () => {
    const { products } = await admin();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const failure = (await products().catch((e: unknown) => e)) as Refusal;

    // Статуса нет, потому что ответа не было вовсе.
    expect(failure.status).toBe(0);
    expect(failure.message).toContain("не отвечает");
  });

  it("204 при удалении не пытается разобрать пустое тело", async () => {
    const { deleteCategory } = await admin();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error("тела нет");
        },
      } as unknown as Response),
    );

    await expect(deleteCategory("id-1")).resolves.toBeUndefined();
  });

  // Потолок размера страницы стоит на портале, но клиент не должен просить
  // больше положенного: заявки — персональные данные.
  it("складывает фильтр и страницу в запрос заявок", async () => {
    const { leads } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [], page: 0, size: 50, total: 0, pages: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await leads("in_progress", 2, 25);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/admin/v1/leads");
    expect(url.searchParams.get("status")).toBe("in_progress");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("size")).toBe("25");
  });

  it("пустой фильтр статуса не уезжает в запрос", async () => {
    const { leads } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [], page: 0, size: 50, total: 0, pages: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await leads("", 0);

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.has("status")).toBe(false);
  });
});

const EMPTY_PAGE = { items: [], page: 0, size: 50, total: 0, pages: 0 };

describe("CRM в клиенте админского API", () => {
  it("складывает все три фильтра сделок в один запрос", async () => {
    const { deals } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json(EMPTY_PAGE));
    vi.stubGlobal("fetch", fetchMock);

    await deals({ pipeline: "dealer", stage: "talks", clientId: "client-1" }, 1, 25);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/admin/v1/deals");
    expect(url.searchParams.get("pipeline")).toBe("dealer");
    expect(url.searchParams.get("stage")).toBe("talks");
    expect(url.searchParams.get("clientId")).toBe("client-1");
    expect(url.searchParams.get("page")).toBe("1");
  });

  // Пустой фильтр — это «все», а не «стадия с пустым именем». Уехавший
  // `stage=` вернул бы пустой список там, где человек ничего не выбирал.
  it("незаданные фильтры сделок в запрос не уезжают", async () => {
    const { deals } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json(EMPTY_PAGE));
    vi.stubGlobal("fetch", fetchMock);

    await deals({});

    const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
    expect(params.has("pipeline")).toBe(false);
    expect(params.has("stage")).toBe(false);
    expect(params.has("clientId")).toBe(false);
  });

  it("поиск клиента уезжает как query, а пустой — не уезжает вовсе", async () => {
    const { clients } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json(EMPTY_PAGE));
    vi.stubGlobal("fetch", fetchMock);

    await clients("перинатальный");
    await clients("");

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("query")).toBe(
      "перинатальный",
    );
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.has("query")).toBe(false);
  });

  // Одна дверь на три вида владельца: путь собирается из того, к чему
  // привязана запись. Ошибка здесь молча пишет историю не тому.
  it("история берётся у того, к кому привязана", async () => {
    const { history, addToHistory } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchMock);

    await history("clients", "client-1");
    await history("deals", "deal-1");
    await addToHistory("leads", "lead-1", {
      kind: "call",
      direction: "in",
      at: null,
      subject: "Созвон",
      body: "Обсудили сроки.",
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/clients/client-1/history");
    expect(fetchMock.mock.calls[1][0]).toContain("/deals/deal-1/history");
    expect(fetchMock.mock.calls[2][0]).toContain("/leads/lead-1/history");
    expect(fetchMock.mock.calls[2][1].method).toBe("POST");
  });

  it("разбор заявки уходит своей дверью, а не правкой сделки", async () => {
    const { convertLead } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "deal-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await convertLead("lead-1", {
      clientId: null,
      pipeline: "sales",
      title: null,
      amount: 2650000,
      owner: "editor",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/leads/lead-1/convert");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).clientId).toBeNull();
  });

  it("период аналитики необязателен и пустым не уезжает", async () => {
    const { analytics } = await admin();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ by: "source", rows: [], totals: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await analytics("campaign", "2026-01-01", "");

    const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
    expect(params.get("by")).toBe("campaign");
    expect(params.get("from")).toBe("2026-01-01");
    expect(params.has("to")).toBe(false);
  });

  // Отцепление документа отвечает карточкой сделки, а не 204: разбор пустого
  // тела здесь означал бы потерю обновлённого списка вложений.
  it("отцепление документа возвращает карточку сделки", async () => {
    const { detachFromDeal } = await admin();
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "deal-1", attachments: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const deal = await detachFromDeal("deal-1", "doc-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/deals/deal-1/attachments/doc-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(deal.attachments).toEqual([]);
  });
});
