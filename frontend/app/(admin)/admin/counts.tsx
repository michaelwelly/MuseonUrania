"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  chatQueue,
  clients,
  deals,
  documents,
  leads,
  news,
  products,
  quotes,
} from "@/lib/admin";

// Счётчики на вкладках.
//
// Зачем они. Вкладка без числа отвечает на вопрос «куда пойти», но не на
// вопрос «есть ли там что-то». Замер прошлой сессии: в ленте новостей ноль
// записей, и узнать это можно было только открыв её. Число рядом с именем
// вкладки снимает переход, который ничего не даёт.
//
// Что именно считается. Везде — сколько всего в разделе. Исключение одно:
// «Разговоры» показывают, сколько ждёт ответа прямо сейчас, а не сколько
// разговоров было. Разговор — единственная запись в портале, у которой
// на том конце человек, и «всего 340» вместо «ждут 3» здесь означало бы
// ровно противоположное тому, ради чего счётчик ставят.
//
// Почему одним запросом на раздел, а не выборкой страниц. Постраничным
// дверям хватает `size=1`: нужен `total`, а не сама страница. Каталог,
// новости и документы отдаются списком целиком — там считается длина.
//
// Отказ одного счётчика не роняет остальные и не роняет оболочку: у вкладки
// просто не будет числа. `Promise.allSettled`, а не `all`, ровно поэтому —
// с `all` первый же отказ стёр бы все восемь.

export type Counts = Partial<{
  products: number;
  news: number;
  documents: number;
  chats: number;
  leads: number;
  clients: number;
  deals: number;
  quotes: number;
}>;

type Store = { counts: Counts; refresh: () => void };

const Ctx = createContext<Store>({ counts: {}, refresh: () => {} });

/**
 * Счётчики разделов и способ их перечитать.
 *
 * `refresh` нужен действиям, которые меняют число: публикация новости,
 * ответ в разговоре, разбор заявки. Без него счётчик остаётся верным ровно
 * до первого действия и дальше тихо врёт.
 */
export function useCounts(): Store {
  return useContext(Ctx);
}

/** Ключ счётчика и как его добыть. Список рядом с типом, чтобы не разошлись. */
const ИСТОЧНИКИ: readonly [keyof Counts, () => Promise<number>][] = [
  ["products", async () => (await products()).length],
  ["news", async () => (await news()).length],
  ["documents", async () => (await documents()).length],
  ["chats", async () => (await chatQueue(0, 1)).total],
  ["leads", async () => (await leads({}, 0, 1)).total],
  ["clients", async () => (await clients("", 0, 1)).total],
  ["deals", async () => (await deals({}, 0, 1)).total],
  ["quotes", async () => (await quotes("", 0, 1)).total],
];

export function CountsHost({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Counts>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;

    void Promise.allSettled(ИСТОЧНИКИ.map(([, load]) => load())).then((results) => {
      if (!alive) return;
      const собрано: Counts = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled") собрано[ИСТОЧНИКИ[i][0]] = result.value;
      });
      // Заменой, а не слиянием: счётчик, который перестал отвечать, должен
      // исчезнуть, а не остаться на экране прошлым значением.
      setCounts(собрано);
    });

    return () => {
      alive = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((a) => a + 1), []);

  return <Ctx.Provider value={{ counts, refresh }}>{children}</Ctx.Provider>;
}
