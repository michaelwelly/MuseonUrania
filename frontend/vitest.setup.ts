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

// jsdom не заводит blob:-адреса: за ними стоит хранилище объектов браузера,
// которого у него нет. На них держатся портреты сотрудников — дверь портрета
// закрыта токеном, поэтому байты приезжают запросом и превращаются в адрес
// для src. Заглушка выдаёт разные адреса намеренно: одинаковые скрыли бы
// ошибку «показали прежний портрет после замены».
if (!URL.createObjectURL) {
  let счёт = 0;
  URL.createObjectURL = () => `blob:test/${++счёт}`;
  URL.revokeObjectURL = () => {};
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
