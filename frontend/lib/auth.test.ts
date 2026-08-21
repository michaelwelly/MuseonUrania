import { beforeEach, describe, expect, it, vi } from "vitest";

const ISSUER = "https://keycloak.test/realms/vedal";

// Модуль читает переменные сборки на уровне модуля, поэтому окружение
// подставляется прямо перед импортом, а импорт делается заново в каждом тесте.
// Ставить их один раз на файл нельзя: unstubAllEnvs в afterEach снимет их,
// и следующий импорт увидит пустой адрес realm'а.
async function auth() {
  vi.stubEnv("NEXT_PUBLIC_OIDC_ISSUER", ISSUER);
  vi.stubEnv("NEXT_PUBLIC_OIDC_CLIENT_ID", "vedal-admin-ui");
  vi.resetModules();
  return import("./auth");
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 900,
      ...overrides,
    }),
  } as Response;
}

describe("вход через Keycloak", () => {
  beforeEach(() => {
    // location.assign в jsdom не реализован и роняет тест шумом, который
    // к делу не относится.
    Object.defineProperty(window, "location", {
      value: { origin: "https://admin.test", pathname: "/admin/", assign: vi.fn(), replace: vi.fn() },
      writable: true,
    });
  });

  it("уводит в Keycloak с challenge'ем, а verifier оставляет у себя", async () => {
    const { login } = await auth();

    await login("/admin/products/");

    const target = new URL(vi.mocked(window.location.assign).mock.calls[0][0] as string);
    expect(target.origin + target.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");

    const verifier = sessionStorage.getItem("vedal.admin.pkce");
    expect(verifier).toBeTruthy();

    // Смысл PKCE в том, что перехваченный адрес не содержит секрета:
    // в запрос уходит хеш, а сам verifier никуда не отправляется.
    const challenge = target.searchParams.get("code_challenge");
    expect(challenge).toBeTruthy();
    expect(challenge).not.toBe(verifier);
    expect(target.searchParams.get("code_verifier")).toBeNull();
  });

  it("обменивает код на токены и возвращает адрес, с которого уходили", async () => {
    const { login, completeLogin, storedTokens } = await auth();
    await login("/admin/leads/");

    const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal("fetch", fetchMock);

    const returnTo = await completeLogin("code-1");

    expect(returnTo).toBe("/admin/leads/");
    expect(storedTokens()?.accessToken).toBe("access-1");
    // Verifier одноразовый: оставить его в хранилище значит дать переиграть
    // обмен на перехваченном коде.
    expect(sessionStorage.getItem("vedal.admin.pkce")).toBeNull();

    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBeTruthy();
  });

  it("отказ Keycloak в обмене кода не выдаёт за вход", async () => {
    const { login, completeLogin, storedTokens } = await auth();
    await login();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response));

    await expect(completeLogin("code-1")).rejects.toThrow(/400/);
    expect(storedTokens()).toBeNull();
  });
});

describe("действующий токен", () => {
  it("отдаёт сохранённый, пока он не истёк", async () => {
    const { accessToken } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "still-good", expiresAt: Date.now() + 600_000 }),
    );

    expect(await accessToken()).toBe("still-good");
  });

  // Токен, истекающий в полёте запроса, — это 401 на ровном месте.
  it("обновляет заранее, не дожидаясь истечения", async () => {
    const { accessToken } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({
        accessToken: "expiring",
        refreshToken: "refresh-1",
        expiresAt: Date.now() + 5_000,
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(tokenResponse({ access_token: "fresh" })));

    expect(await accessToken()).toBe("fresh");
  });

  // Refresh-токен одноразовый: параллельные вызовы, обновляющие каждый сам,
  // получают отказ по уже использованному токену — все, кроме одного.
  it("обновляет одним запросом, сколько бы вызовов ни пришло разом", async () => {
    const { accessToken } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );

    const fetchMock = vi.fn().mockResolvedValue(tokenResponse({ access_token: "fresh" }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([accessToken(), accessToken(), accessToken()]);

    expect(results).toEqual(["fresh", "fresh", "fresh"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("забывает токены, если обновить не удалось", async () => {
    const { accessToken, storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response));

    expect(await accessToken()).toBeNull();
    expect(storedTokens()).toBeNull();
  });

  // Отказ отказу рознь.
  //
  // Раньше вход стирался при любом неуспешном ответе, и перезапуск Keycloak
  // или шлюза был неотличим от мёртвого токена. На стенде шлюз перезапускается
  // при каждой выкатке — человек возвращался на экран пароля по нескольку раз
  // за час, хотя его сессия была жива.
  it("не выбрасывает вход из-за сбоя на стороне Keycloak", async () => {
    const { accessToken, storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    expect(await accessToken()).toBeNull();
    expect(storedTokens(), "токены остаются: следующее действие попробует снова").not.toBeNull();
    expect(fetchMock, "одна повторная попытка").toHaveBeenCalledTimes(2);
  });

  it("не выбрасывает вход, если сеть не ответила", async () => {
    const { accessToken, storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("сеть недоступна")));

    expect(await accessToken()).toBeNull();
    expect(storedTokens()).not.toBeNull();
  });

  it("переживает разовый сбой и обновляет со второй попытки", async () => {
    const { accessToken } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(tokenResponse({ access_token: "fresh" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await accessToken()).toBe("fresh");
  });

  // Единственный ответ, означающий «этот токен больше не действует».
  it("сбрасывает вход на invalid_grant", async () => {
    const { accessToken, storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1 }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) } as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await accessToken()).toBeNull();
    expect(storedTokens()).toBeNull();
    expect(fetchMock, "повторять мёртвый токен незачем").toHaveBeenCalledTimes(1);
  });

  // Ради чего хранилище менялось: закрытая вкладка не должна стоить пароля.
  it("переживает закрытие вкладки", async () => {
    const { storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "живой", expiresAt: Date.now() + 600_000 }),
    );

    // Закрытие вкладки: sessionStorage бы очистился, localStorage — нет.
    sessionStorage.clear();
    const { storedTokens: послеЗакрытия } = await auth();

    expect(послеЗакрытия()?.accessToken).toBe("живой");
    expect(storedTokens()?.accessToken).toBe("живой");
  });

  // Цена переноса: раньше сессию ограничивало само закрытие вкладки, теперь
  // нужен явный предел. Ноутбук, закрытый в пятницу, в понедельник встречает
  // экраном входа.
  it("не восстанавливает сессию после предела её жизни", async () => {
    const { storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({
        accessToken: "живой",
        expiresAt: Date.now() + 600_000,
        endsAt: Date.now() - 1,
      }),
    );

    expect(storedTokens(), "предел важнее срока токена доступа").toBeNull();
    expect(localStorage.getItem("vedal.admin.tokens"), "просроченное не залёживается").toBeNull();
  });

  it("предел ставится один раз и переживает продления", async () => {
    const { accessToken, storedTokens } = await auth();
    const предел = Date.now() + 60_000;
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", refreshToken: "refresh-1", expiresAt: Date.now() - 1, endsAt: предел }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(tokenResponse({ access_token: "fresh" })));

    expect(await accessToken()).toBe("fresh");
    expect(storedTokens()?.endsAt, "продление не отодвигает предел").toBe(предел);
  });

  // localStorage общий на весь браузер: выход в одной вкладке обязан гасить
  // остальные, иначе вторая показывает рабочий интерфейс, из которого
  // ни один запрос уже не проходит.
  it("сообщает другим вкладкам, что вход пропал", async () => {
    const { onSessionLost } = await auth();
    const узнали = vi.fn();
    const отписаться = onSessionLost(узнали);

    window.dispatchEvent(new StorageEvent("storage", { key: "vedal.admin.tokens", newValue: null }));

    expect(узнали).toHaveBeenCalledTimes(1);

    отписаться();
    window.dispatchEvent(new StorageEvent("storage", { key: "vedal.admin.tokens", newValue: null }));
    expect(узнали, "после отписки не дёргаем").toHaveBeenCalledTimes(1);
  });

  it("не путает выход с записью чужого ключа", async () => {
    const { onSessionLost } = await auth();
    const узнали = vi.fn();
    onSessionLost(узнали);

    window.dispatchEvent(new StorageEvent("storage", { key: "что-то-другое", newValue: null }));
    window.dispatchEvent(new StorageEvent("storage", { key: "vedal.admin.tokens", newValue: "{}" }));

    expect(узнали).not.toHaveBeenCalled();
  });

  it("без refresh-токена не делает вид, что вход есть", async () => {
    const { accessToken } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "old", expiresAt: Date.now() - 1 }),
    );

    expect(await accessToken()).toBeNull();
  });

  it("битое значение в хранилище не роняет админку", async () => {
    const { storedTokens } = await auth();
    localStorage.setItem("vedal.admin.tokens", "{это не json");

    expect(storedTokens()).toBeNull();
    expect(localStorage.getItem("vedal.admin.tokens")).toBeNull();
  });
});

describe("выход", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://admin.test", pathname: "/admin/", assign: vi.fn(), replace: vi.fn() },
      writable: true,
    });
  });

  // Токен в строке запроса оседает в истории браузера, в Referer следующего
  // перехода и в access-логе Keycloak и любого прокси перед ним.
  it("не кладёт refresh-токен в адрес", async () => {
    const { logout } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "a", refreshToken: "secret-refresh", expiresAt: Date.now() + 1 }),
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal("fetch", fetchMock);

    logout();

    const target = vi.mocked(window.location.assign).mock.calls[0][0] as string;
    expect(target).not.toContain("secret-refresh");
    expect(target).not.toContain("refresh_token");

    // Отзыв идёт телом запроса, а не адресом.
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("refresh_token")).toBe("secret-refresh");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("стирает токены из вкладки, даже если отзыв не ушёл", async () => {
    const { logout, storedTokens } = await auth();
    localStorage.setItem(
      "vedal.admin.tokens",
      JSON.stringify({ accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 1 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("сеть недоступна")));

    logout();

    expect(storedTokens()).toBeNull();
  });
});
