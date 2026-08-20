// Типы к vendor/tree-growth.js. Сам файл не трогаем: он передан отдельным
// пакетом и заменяется целиком при следующей передаче, поэтому правки в нём
// потерялись бы молча.
//
// Библиотека — IIFE: при импорте выполняется и кладёт функцию в window.
// Отсюда declare global рядом с declare module: импортировать нужно ради
// побочного эффекта, а вызывать через window.

export type TreeGrowthOptions = {
  /** Цвет всех фигур. По умолчанию зелёный исходника #419f3b. */
  color?: string;
  /** 1 — полные 3.5 с, больше — быстрее. */
  speed?: number;
  /** false — начать на нулевом кадре и ждать play(). */
  autoplay?: boolean;
  /** Вызывается, когда анимация замерла на готовом знаке. */
  onDone?: () => void;
};

export type TreeGrowthHandle = {
  /** Длительность с учётом speed, в секундах. */
  duration: number;
  play(): TreeGrowthHandle;
  reset(): TreeGrowthHandle;
  /** Перемотать на секунду t и замереть. */
  seek(t: number): TreeGrowthHandle;
};

declare global {
  interface Window {
    treeGrowth?: (el: Element, options?: TreeGrowthOptions) => TreeGrowthHandle;
  }
}

declare module "@/vendor/tree-growth.js";
