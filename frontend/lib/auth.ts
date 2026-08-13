// Вход в админку через Keycloak: код авторизации с PKCE.
//
// Почему публичный клиент и PKCE, а не секрет клиента: код админки выполняется
// в браузере, и любой «секрет» в нём не секрет. PKCE закрывает ровно ту дыру,
// которая от этого появляется, — перехваченный код авторизации бесполезен
// без verifier'а, который никуда не отправлялся.
//
// Где лежат токены. Access и refresh — в sessionStorage: он умирает вместе
// с вкладкой и не виден другим вкладкам того же браузера. Это не идеал:
// идеал — httpOnly-кука и обмен токенами на стороне сервера (BFF), тогда
// скрипт на странице не может добраться до токена вообще. Пока админка
// статическая и своего сервера у неё нет, BFF ставить некуда; когда
// понадобится — это отдельная задача, и она сведётся к замене этого файла.
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
  /** Время истечения в миллисекундах эпохи. */
  expiresAt: number;
};

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
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    // Битое значение — не повод падать: считаем, что входа нет.
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function store(tokens: Tokens) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function forget() {
  sessionStorage.removeItem(STORAGE_KEY);
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

async function refresh(refreshToken: string): Promise<Tokens | null> {
  const response = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    forget();
    return null;
  }

  const tokens = toTokens(await response.json());
  store(tokens);
  return tokens;
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
