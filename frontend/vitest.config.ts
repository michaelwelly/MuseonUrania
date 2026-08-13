import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Тесты фронтенда. Vitest, а не встроенный раннер Next: он умеет и модули
// без React (клиент API, вход), и компоненты, и не требует сборки всего
// приложения ради одного файла.
//
// Что здесь проверяется, а что нет. Проверяется поведение, которое ломается
// молча: разбор ошибок портала, обновление токена, состояние формы при
// переключении карточек. Не проверяется вёрстка — снимки разметки ломаются
// от переноса строки и не ловят ни одной настоящей ошибки.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Тот же алиас, что в tsconfig: без него импорты «@/lib/...» не находятся.
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
    // Тест, который «просто медленный», обычно на самом деле висит
    // на неотвеченном запросе.
    testTimeout: 10_000,
  },
});
