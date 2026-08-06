// Ревилы при скролле, «живой» текст и индикатор прокрутки.
// Значения из design_handoff_vedal_animations/README.md, без зависимостей.
// Монтируется один раз в components/Motion.tsx.

const EASE = "cubic-bezier(.2,.8,.2,1)";

// Скроллером не всегда является documentElement: внутри превью, iframe или
// вебвью прокручивается body, и тогда documentElement.scrollTop всегда 0.
function scroller(): Element {
  const de = document.scrollingElement ?? document.documentElement;
  if (de.scrollHeight > de.clientHeight + 1) return de;
  return document.body;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param stagger  задержка между блоками одной группы, мс
 * @param distance сдвиг вверх при появлении, px
 * @returns снять слушатели
 */
export function mountMotion({ stagger = 70, distance = 26 } = {}): () => void {
  // Продукт медицинский: при выключенном движении не прячем вообще ничего,
  // иначе появление превращается в моргание.
  if (reduced()) return scrollProgress();

  let blocks = hideBelowFold(distance);
  let words = splitAll();
  const fold = () => window.innerHeight - 60;

  // Проверяем прямоугольники в тике скролла, а не через IntersectionObserver:
  // при мгновенном прыжке (переход по якорю, смена маршрута) элемент за один
  // кадр проходит мимо вьюпорта, наблюдатель молчит — и блок остаётся скрытым
  // навсегда.
  const sweep = () => {
    const line = fold();
    if (blocks.length) {
      blocks = blocks.filter((el) => {
        if (el.getBoundingClientRect().top >= line) return true;
        showBlock(el, stagger);
        return false;
      });
    }
    if (words.length) {
      words = words.filter((el) => {
        if (el.getBoundingClientRect().top >= line) return true;
        showWords(el);
        return false;
      });
    }
  };

  return scrollProgress(sweep);
}

// ── Блоки ──────────────────────────────────────────────────────
// Разметка ставит data-reveal="<индекс в группе>" — индекс задаёт каскад
// внутри группы. Прячем только то, что ниже сгиба, и только из JS: с CSS
// страница без JS осталась бы пустой, а первый экран мигал бы до гидратации.

function hideBelowFold(distance: number): HTMLElement[] {
  const fold = window.innerHeight - 80;
  const pending: HTMLElement[] = [];

  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    if (el.dataset.revealed) return;
    if (el.getBoundingClientRect().top < fold) {
      el.dataset.revealed = "1";
      return;
    }
    el.style.opacity = "0";
    el.style.transform = `translateY(${distance}px)`;
    el.style.transition = `opacity .7s ${EASE}, transform .7s ${EASE}`;
    pending.push(el);
  });

  return pending;
}

function showBlock(el: HTMLElement, stagger: number) {
  el.style.transitionDelay = `${(Number(el.dataset.reveal) || 0) * stagger}ms`;
  el.style.opacity = "1";
  el.style.transform = "none";
  el.dataset.revealed = "1"; // обратно не прячем — появилось и осталось
}

// ── Живой текст ────────────────────────────────────────────────
// data-words="<шаг, мс>" на заголовке или лиде, необязательный
// data-wdelay="<стартовая задержка, мс>". Разбор на слова в JS, а не в
// разметке: текст остаётся редактируемым и читается без JS.

function splitAll(): HTMLElement[] {
  const fold = window.innerHeight - 40;
  const pending: HTMLElement[] = [];

  document.querySelectorAll<HTMLElement>("[data-words]").forEach((el) => {
    if (el.dataset.wordsDone) return;
    splitWords(el);
    if (el.getBoundingClientRect().top < fold) showWords(el);
    else pending.push(el);
  });

  return pending;
}

function splitWords(el: HTMLElement) {
  if (el.dataset.split) return;
  const text = el.textContent ?? "";
  el.textContent = "";

  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (!part.trim()) {
      el.appendChild(document.createTextNode(part)); // пробелы как есть
      return;
    }
    const span = document.createElement("span");
    span.setAttribute("data-w", "");
    span.textContent = part;
    span.style.opacity = "0";
    span.style.transform = "translateY(.45em)";
    el.appendChild(span);
  });

  el.dataset.split = "1";
}

function showWords(el: HTMLElement) {
  const step = Number(el.dataset.words) || 30;
  const base = Number(el.dataset.wdelay) || 0;

  el.querySelectorAll<HTMLElement>(":scope > span[data-w]").forEach((span, i) => {
    span.style.transition = `opacity .5s ease, transform .55s ${EASE}`;
    span.style.transitionDelay = `${base + i * step}ms`;
    span.style.opacity = "1";
    span.style.transform = "none";
  });

  el.dataset.wordsDone = "1";
}

// ── Индикатор прокрутки ────────────────────────────────────────
// Ищет [data-scroll-fill]. onTick вызывается тем же rAF-тиком, чтобы не
// плодить обработчики скролла.

function scrollProgress(onTick?: () => void): () => void {
  const fill = document.querySelector<HTMLElement>("[data-scroll-fill]");
  let frame = 0;

  const update = () => {
    frame = 0;
    const sc = scroller();
    const max = sc.scrollHeight - sc.clientHeight;
    if (fill) fill.style.transform = `scaleX(${max > 0 ? Math.min(1, sc.scrollTop / max) : 0})`;
    onTick?.();
  };

  // Скролл элемента не всплывает до window — слушаем на document в фазе
  // перехвата, иначе при прокрутке body индикатор стоит на месте.
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);
  };
}
