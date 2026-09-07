import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom не даёт Web Crypto с subtle, а на нём стоит PKCE. Подставляем
// настоящую реализацию из Node: подделывать хеш здесь нельзя — проверка
// challenge'а и есть то, ради чего PKCE существует.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

// jsdom не умеет прокручивать: у него нет ни раскладки, ни экрана, и
// scrollIntoView в нём просто не определён. Лента разговора вызывает его
// после каждой отрисовки, чтобы показывать последнее сообщение, — без этой
// заглушки падает не проверка прокрутки (её и нет), а сам рендер компонента.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
