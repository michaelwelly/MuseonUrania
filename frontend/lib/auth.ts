// Вход в админку через Keycloak: код авторизации с PKCE.
//
// Почему публичный клиент и PKCE, а не секрет клиента: код админки выполняется
// в браузере, и любой «секрет» в нём не секрет. PKCE закрывает ровно ту дыру,
// которая от этого появляется, — перехваченный код авторизации бесполезен
// без verifier'а, который никуда не отправлялся.
//
// Где лежат токены. Access и refresh — в localStorage: вход переживает
// закрытие вкладки, и вернувшийся через полчаса человек продолжает работу,
// а не вводит пароль заново.
//
// Чем за это платим и чем платёж ограничен. sessionStorage умирал вместе
// с вкладкой, и это само по себе было ограничителем: чужой человек за тем же
// компьютером не попадал в чужую сессию. Теперь ограничителей три, и они
// заданы явно:
//
//   * потолок жизни сессии (SESSION_MAX_MS) — запись хранит время, после
//     которого не восстанавливается ни при каких условиях. Ноутбук, закрытый
//     в пятницу, в понедельник встречает экраном входа;
//   * час бездействия — его держит Keycloak (ssoSessionIdleTimeout), и это
//     настоящая проверка: refresh-токен просто перестаёт приниматься;
//   * выход в одной вкладке гасит остальные — localStorage общий, и молча
//     оставленная открытой вторая вкладка не должна пережить выход.
//
// От XSS ни то ни другое хранилище не защищает: скрипт на странице читает
// оба одинаково. Идеал прежний — httpOnly-кука и обмен токенами на стороне
// сервера (BFF); пока админка статическая, ставить его некуда.
//
// PKCE-verifier и адрес возврата остаются в sessionStorage намеренно: они
// живут один вход и принадлежат вкладке. В общем хранилище параллельный
// вход во второй вкладке затёр бы verifier первой.
//
// Роли и права проверяет портал. Здесь только вход: интерфейс, спрятавший
// кнопку, ничего не защищает — запрос всё равно можно послать руками.

const ISSUER = (process.env.NEXT_PUBLIC_OIDC_ISSUER ?? "").replace(/\/+$/, "");
const CLIENT_ID = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "vedal-admin-ui";

export const authConfigured = ISSUER !== "";

const STORAGE_KEY = "vedal.admin.tokens";
const VERIFIER_KEY = "vedal.admin.pkce";
const RETURN_KEY = "vedal.admin.return";

export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  /** Время истечения токена доступа в миллисекундах эпохи. */
  expiresAt: number;
  /**
   * Предел жизни всей сессии. Ставится один раз при входе и переживает
   * продления: иначе бесконечная цепочка обновлений держала бы вход вечно.
   * Совпадает с ssoSessionMaxLifespan в realm'е — десять часов, рабочий день.
   */
  endsAt?: number;
};

const SESSION_MAX_MS = 10 * 60 * 60 * 1000;

const authorizeUrl = () => `${ISSUER}/protocol/openid-connect/auth`;
const tokenUrl = () => `${ISSUER}/protocol/openid-connect/token`;
const logoutUrl = () => `${ISSUER}/protocol/openid-connect/logout`;

const redirectUri = () => `${window.location.origin}/admin/callback/`;

// ————— PKCE —————

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ————— хранение —————

export function storedTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let tokens: Tokens;
  try {
    tokens = JSON.parse(raw) as Tokens;
  } catch {
    // Битое значение — не повод падать: считаем, что входа нет.
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  // Потолок жизни сессии. Проверяется при чтении, а не по таймеру: браузер
  // мог быть закрыт, и таймеру было бы негде тикать.
  if (tokens.endsAt && Date.now() >= tokens.endsAt) {
    forget();
    return null;
  }
  return tokens;
}

function store(tokens: Tokens) {
  // Потолок ставится один раз за сессию и переносится через все продления.
  const endsAt = storedTokens()?.endsAt ?? Date.now() + SESSION_MAX_MS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...tokens, endsAt }));
}

export function forget() {
  localStorage.removeItem(STORAGE_KEY);
}

// ————— согласование вкладок —————

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Сообщает, что вход пропал в другой вкладке.
 *
 * localStorage общий на весь браузер, поэтому выход в одной вкладке обязан
 * гасить остальные. Без этого вторая вкладка продолжала бы показывать
 * рабочий интерфейс, из которого ни один запрос уже не проходит.
 */
export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    // newValue === null означает removeItem, то есть выход или сброс.
    if (event.key === STORAGE_KEY && event.newValue === null) {
      listeners.forEach((listener) => listener());
    }
  });
}

// ————— вход —————

/** Уводит браузер в Keycloak. Возврат — на /admin/callback/. */
export async function login(returnTo?: string) {
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_KEY, returnTo ?? window.location.pathname);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid profile email",
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
  });

  // Уход на чужой origin — Keycloak. Роутер Next здесь не годится: он умеет
  // переходы внутри приложения, а нам нужен настоящий переход браузера,
  // иначе не будет ни редиректа обратно, ни установки сессии Keycloak.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${authorizeUrl()}?${params}`);
}

/** Обмен кода на токены. Возвращает адрес, с которого уходили. */
export async function completeLogin(code: string): Promise<string> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Не найден verifier PKCE: начните вход заново.");

  const response = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Keycloak отказал в обмене кода: ${response.status}`);
  }

  store(toTokens(await response.json()));
  sessionStorage.removeItem(VERIFIER_KEY);

  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? "/admin/";
  sessionStorage.removeItem(RETURN_KEY);
  return returnTo;
}

export function logout() {
  const tokens = storedTokens();
  forget();
  if (!authConfigured) return;

  // Сначала гасим сессию на стороне Keycloak фоновым запросом. Именно так
  // отзывается refresh-токен: у адреса выхода в браузере для этого нет
  // параметра, и подставить туда токен нельзя — он осел бы в истории
  // браузера, в Referer следующего перехода и в access-логе Keycloak
  // и любого прокси перед ним.
  if (tokens?.refreshToken) {
    void fetch(`${ISSUER}/protocol/openid-connect/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: tokens.refreshToken,
      }),
      // keepalive: запрос обязан уйти, даже если страница уже уходит
      // на адрес выхода.
      keepalive: true,
    }).catch(() => {
      // Не ушёл — токен всё равно стёрт из вкладки, а сам он истечёт
      // по сроку. Ронять выход из-за этого незачем.
    });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: `${window.location.origin}/admin/`,
  });
  // id_token_hint не храним: он нужен только затем, чтобы Keycloak не
  // переспрашивал подтверждение выхода. Лишний экран лучше лишнего токена
  // в sessionStorage.
  //
  // Тот же случай, что и при входе: переход на чужой origin.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${logoutUrl()}?${params}`);
}

// ————— действующий токен —————

// Запас в тридцать секунд: токен, истекающий в полёте запроса, — это 401
// на ровном месте.
const SKEW_MS = 30_000;

let refreshing: Promise<Tokens | null> | null = null;

/** Действующий access-токен или null, если входа нет и обновить нечем. */
export async function accessToken(): Promise<string | null> {
  const tokens = storedTokens();
  if (!tokens) return null;
  if (Date.now() + SKEW_MS < tokens.expiresAt) return tokens.accessToken;
  if (!tokens.refreshToken) {
    forget();
    return null;
  }

  // Один запрос на обновление, сколько бы вызовов ни пришло разом: иначе
  // параллельные запросы админки обновляют токен каждый сам, и все, кроме
  // одного, получают отказ по уже использованному refresh-токену.
  refreshing ??= refresh(tokens.refreshToken).finally(() => {
    refreshing = null;
  });

  return (await refreshing)?.accessToken ?? null;
}

// Сколько ждать между попытками обновления. Сбой на той стороне —
// перезапуск Keycloak, перезапуск шлюза, обрыв — обычно короче, чем пауза
// между двумя действиями человека.
const RETRY_MS = 700;

async function refresh(refreshToken: string): Promise<Tokens | null> {
  // Две попытки, потому что отказ отказу рознь.
  //
  // Раньше вход стирался при любом неуспешном ответе. Отказ «refresh-токен
  // мёртв» и отказ «Keycloak сейчас перезапускается» выглядели одинаково,
  // и секундная заминка на той стороне возвращала человека на экран пароля.
  // На стенде, где шлюз перезапускается при каждой выкатке, это означало
  // вход заново несколько раз за час.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(tokenUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Сеть не ответила. Токен от этого не перестал действовать —
      // выбрасывать его нельзя.
      if (attempt === 0) {
        await pause(RETRY_MS);
        continue;
      }
      return null;
    }

    if (response.ok) {
      const tokens = toTokens(await response.json());
      store(tokens);
      return tokens;
    }

    // invalid_grant — единственный ответ, означающий «этот токен больше
    // не действует». Держать его дальше незачем, и вход честно сбрасывается.
    if (await isDeadToken(response)) {
      forget();
      return null;
    }

    // Всё остальное — сбой на той стороне. Токены остаются: следующее
    // действие человека попробует снова, и обычно этого хватает.
    if (attempt === 0) await pause(RETRY_MS);
  }

  return null;
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Отличает мёртвый refresh-токен от сбоя на стороне Keycloak. */
async function isDeadToken(response: Response): Promise<boolean> {
  // 5xx — это никогда не про токен.
  if (response.status >= 500) return false;
  try {
    const body = (await response.json()) as { error?: string };
    return body.error === "invalid_grant" || body.error === "invalid_token";
  } catch {
    // Тело не разобралось. На 400 это всё равно отказ по запросу,
    // а не по связи.
    return response.status === 400;
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

function toTokens(body: TokenResponse): Tokens {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (body.expires_in ?? 300) * 1000,
  };
}

/** Имя пользователя из токена — для шапки админки и ничего больше. */
export function actorName(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.preferred_username ?? payload.email ?? "—";
  } catch {
    // Разбор токена здесь — украшение шапки. Не разобрался — не беда,
    // права всё равно проверяет портал.
    return "—";
  }
}
