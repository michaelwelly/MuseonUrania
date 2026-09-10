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

const storageState = new WeakMap<object, Map<string, string>>();
let storagePrototypeReady = false;

function storeOf(storage: object): Map<string, string> {
  let store = storageState.get(storage);
  if (!store) {
    store = new Map<string, string>();
    storageState.set(storage, store);
  }
  return store;
}

function installMemoryStoragePrototype() {
  if (storagePrototypeReady || typeof Storage === "undefined") return;

  Object.defineProperties(Storage.prototype, {
    length: {
      configurable: true,
      get() {
        return storeOf(this).size;
      },
    },
    clear: {
      configurable: true,
      value() {
        storeOf(this).clear();
      },
    },
    getItem: {
      configurable: true,
      value(key: string) {
        return storeOf(this).get(String(key)) ?? null;
      },
    },
    key: {
      configurable: true,
      value(index: number) {
        return Array.from(storeOf(this).keys())[index] ?? null;
      },
    },
    removeItem: {
      configurable: true,
      value(key: string) {
        storeOf(this).delete(String(key));
      },
    },
    setItem: {
      configurable: true,
      value(key: string, value: string) {
        storeOf(this).set(String(key), String(value));
      },
    },
  });

  storagePrototypeReady = true;
}

function memoryStorage(): Storage {
  const storage = Object.create(Storage.prototype) as Storage;
  storageState.set(storage, new Map<string, string>());
  return storage;
}

beforeEach(() => {
  installMemoryStoragePrototype();
  const local = memoryStorage();
  const session = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: local,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: session,
    configurable: true,
  });
  Object.defineProperty(window, "localStorage", {
    value: local,
    configurable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: session,
    configurable: true,
  });
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
