import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Сторож палитры.
//
// Контраст текста чинился дважды — на сайте и в админке, — и оба раза дефект
// был один: фирменный --green под белым текстом даёт 3.59 при норме 4.5.
// Проверка глазами его не ловит: зелёная кнопка с белой надписью выглядит
// нормально, пока не посчитаешь. Поэтому считает сборка.

const root = import.meta.dirname ? join(import.meta.dirname, "..") : ".";

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    if (entry.isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  });
}

type Rule = { file: string; selector: string; body: string };

function rules(): Rule[] {
  const found: Rule[] = [];
  for (const file of [...cssFiles(join(root, "app")), ...cssFiles(join(root, "components"))]) {
    const css = readFileSync(file, "utf8");
    css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selector: string, body: string) => {
      found.push({ file: file.slice(root.length + 1), selector: selector.trim().replace(/\s+/g, " "), body });
      return whole;
    });
  }
  return found;
}

const luminance = (c: number[]) => {
  const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: number[], b: number[]) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function token(name: string): string {
  const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
  const found = globals.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`токен ${name} пропал из globals.css`);
  return found[1];
}

describe("палитра", () => {
  const white = [255, 255, 255];

  it("--green-dark годится под белый текст и как текст на белом", () => {
    expect(contrast(hex(token("--green-dark")), white)).toBeGreaterThanOrEqual(4.5);
  });

  it("--green-ink-hover не светлее того, что осветляет", () => {
    // Наведение обязано затемнять. До правки оно осветляло до --green-bright,
    // и кнопка под курсором давала 2.86 — хуже, чем в покое.
    expect(contrast(hex(token("--green-ink-hover")), white))
      .toBeGreaterThan(contrast(hex(token("--green-dark")), white));
  });

  // Главная проверка. Фирменный --green остаётся на логотипе, узорах, точках
  // карты и маркерах — там нет текста, норма 3:1, и 3.59 её проходит. Но под
  // белой надписью он не годится, и новая кнопка не должна появиться молча.
  it("фирменный --green не стоит заливкой под белым текстом", () => {
    const guilty = rules()
      .filter((rule) => /background(-color)?:\s*var\(--green\)/.test(rule.body))
      .filter((rule) => /(^|[;{])\s*color:\s*(#fff\b|#ffffff|white)/i.test(rule.body))
      .map((rule) => `${rule.file}  ${rule.selector.slice(0, 60)}`);

    expect(guilty, `под белым текстом нужен --green-dark: ${contrast(hex(token("--green")), white).toFixed(2)} против 4.5`)
      .toEqual([]);
  });
});
