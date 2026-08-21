"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  deals,
  moveDeal,
  pipelines as loadPipelines,
  type DealRow,
  type Page,
  type Pipeline,
} from "@/lib/admin";
import { plural } from "@/lib/plural";
import { Avatar } from "../Avatar";
import { useToast } from "../Toast";
import { PIPELINE, STAGE, label } from "../labels";
import { useStored } from "../lists";
import { Reason } from "./Reason";
import { Empty, Note, Segments, State, message, money, useLoad, when } from "../ui";

// Сделки: доска и список.
//
// Доска отвечает на вопрос «что где стоит», список — «найди мне вот эту».
// Это разные вопросы, и один экран на оба был бы плох для обоих: доска
// без колонок перестаёт быть доской, а список из карточек не сортируется
// и не читается по колонкам.
//
// ───────────────────────────────────────────────────────────────────────────
// Почему у доски всегда одна воронка
//
// Стадии принадлежат воронке: «диагностика» есть только в сервисной,
// «договор» — только в дилерской. Доска из объединения всех стадий — это
// двенадцать колонок, из которых для каждой сделки осмысленны четыре.
//
// Список воронку не требует: там стадия просто значение в ячейке.
//
// ───────────────────────────────────────────────────────────────────────────
// Перетаскивание — не единственный способ
//
// Мышью карточка переносится между колонками, но стадия меняется и в самой
// сделке, выбором из списка. Это не дублирование: перетаскивание недоступно
// с клавиатуры вовсе, и доска, где стадию можно поменять только мышью,
// закрыта для человека, который работает без неё.

export default function DealsPage() {
  // useSearchParams требует границы Suspense: без неё страница, собранная
  // заранее, падает на сборке, а не в браузере.
  return (
    <Suspense fallback={<p className="muted">Загружаем…</p>}>
      <Deals />
    </Suspense>
  );
}

function Deals() {
  const params = useSearchParams();
  const clientId = params.get("client") ?? "";
  // Ответственный приходит адресом — с карточки сотрудника. Число нагрузки
  // без такого перехода остаётся числом, на которое нельзя посмотреть.
  const owner = params.get("owner") ?? "";
  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);

  const [pipeline, setPipeline] = useState("sales");
  const [view, setView] = useStored<"board" | "list">("vedal.admin.deals.view", "board");

  // Сделки одного клиента или одного сотрудника — это всегда список:
  // и у клиента, и у менеджера сделки лежат в разных воронках, а доска
  // показала бы их порознь.
  const узкий = Boolean(clientId || owner);
  const режим = узкий ? "list" : view;
  const funnel = funnels?.find((f) => f.pipeline === pipeline);

  return (
    <>
      <div className="admin-head">
        <h1>Сделки</h1>
        <div className="row">
          {!узкий && (
            <>
              <Segments
                label="Воронка"
                value={pipeline}
                options={(funnels ?? []).map((f) => f.pipeline)}
                dict={PIPELINE}
                onChange={setPipeline}
              />
              <Segments
                label="Как показывать"
                value={view}
                options={["board", "list"]}
                dict={{ board: "Доска", list: "Список" }}
                onChange={(v) => setView(v as "board" | "list")}
              />
            </>
          )}
          <Link className="btn btn--primary" href="/admin/deals/new/">
            Новая сделка
          </Link>
        </div>
      </div>

      <p className="admin-hint">
        Суммы и условия — закрытый контур: наружу они не уходят ни в публичное API, ни
        в топики. Событие о сделке несёт идентификатор, воронку и стадию, но не имя клиента
        и не сумму.
      </p>

      {clientId && (
        <p className="admin-hint">
          Показаны сделки одного клиента. <Link href="/admin/deals/">Показать все</Link>
        </p>
      )}

      {owner && (
        <p className="admin-hint">
          {/* «-» — это «без ответственного», а не логин. «Сделки одного
              сотрудника: -» — предложение, в котором на месте человека
              стоит дефис. */}
          {owner === "-" ? (
            <>Показаны сделки без ответственного. </>
          ) : (
            <>
              Показаны сделки одного сотрудника: <span className="mono">{owner}</span>.{" "}
            </>
          )}
          <Link href="/admin/deals/">Показать все</Link>
        </p>
      )}

      {/* Пока справочник воронок не приехал, вид неизвестен: у доски без
          стадий нет колонок, а список, показанный «пока что», успевает
          сходить в портал за отбором, которого человек не просил, —
          и мигнуть таблицей там, где будет доска. */}
      {!funnels ? (
        <p className="muted">Загружаем…</p>
      ) : режим === "board" && funnel ? (
        <Board funnel={funnel} />
      ) : (
        <List pipeline={узкий ? "" : pipeline} clientId={clientId} owner={owner} />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Доска

const В_КОЛОНКЕ = 40;

type Колонка = { stage: string; rows: DealRow[]; total: number };

function Board({ funnel }: { funnel: Pipeline }) {
  const toast = useToast();
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DealRow | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ deal: DealRow; stage: string } | null>(null);

  // Время заводится один раз на отрисовку доски: «без изменений 5 дней»
  // не обязано тикать посекундно, а Date.now() в теле карточки давал бы
  // новое значение на каждую перерисовку.
  const [now] = useState(() => Date.now());

  // Прочитанное помечено тем запросом, которым получено. Так «ещё едет»
  // становится вычисляемым — сравнением ключей, — и не нужен сброс
  // состояния в начале эффекта: он давал бы лишний проход отрисовки,
  // на котором доска мигает пустотой при каждой смене воронки.
  const token = `${funnel.pipeline}:${beat}`;
  const [loaded, setLoaded] = useState<{
    token: string;
    columns: Колонка[];
    failed: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    void Promise.allSettled(
      funnel.stages.map((stage) => deals({ pipeline: funnel.pipeline, stage }, 0, В_КОЛОНКЕ)),
    ).then((результаты) => {
      if (!alive) return;
      setLoaded({
        token,
        columns: funnel.stages.map((stage, i) => {
          const r = результаты[i];
          return r.status === "fulfilled"
            ? { stage, rows: r.value.items, total: r.value.total }
            : { stage, rows: [], total: 0 };
        }),
        failed: результаты.filter((r) => r.status === "rejected").length,
      });
    });

    return () => {
      alive = false;
    };
  }, [funnel, token]);

  const свежее = loaded?.token === token ? loaded : null;
  const columns = свежее?.columns ?? null;

  // Отказ стадии называется отдельно от отказа действия: пустая колонка,
  // которая на самом деле не ответила, выглядит как «здесь ничего нет»,
  // и по ней принимают решения.
  const отказы =
    свежее && свежее.failed > 0
      ? `Не удалось прочитать ${свежее.failed} ` +
        `${plural(свежее.failed, "стадию", "стадии", "стадий")}. ` +
        "Пустая колонка здесь может означать не «пусто», а «не ответило»."
      : null;

  const перенести = useCallback(
    async (deal: DealRow, stage: string, reason: string | null) => {
      const было = deal.stage;
      setError(null);
      try {
        await moveDeal(deal.id, stage, reason);
        setBeat((b) => b + 1);
        toast(`«${deal.title}» → ${label(STAGE, stage)}`, async () => {
          // Обратный перенос причины не требует: её спрашивают только
          // на входе в отказную стадию.
          await moveDeal(deal.id, было, null);
          setBeat((b) => b + 1);
        });
      } catch (e) {
        setError(message(e));
      }
    },
    [toast],
  );

  const бросить = (stage: string) => {
    const deal = drag;
    setDrag(null);
    setOver(null);
    if (!deal || deal.stage === stage) return;

    // Перевод в отказ требует причины — это ограничение домена, а не
    // придирка формы: без причины портал откажет, и сделка останется
    // на месте без объяснения.
    if (funnel.lostStages.includes(stage)) {
      setAsking({ deal, stage });
      return;
    }
    void перенести(deal, stage, null);
  };

  return (
    <>
      <Note kind="error">{error ?? отказы}</Note>

      <div className="board">
        {funnel.stages.map((stage) => {
          const column = columns?.find((c) => c.stage === stage);
          // Сумма показывается, только когда в колонке видно всё И там
          // есть что складывать. «0,00 RUB» под пустой стадией читается
          // как настоящая сумма, равная нулю, — а означает «здесь ничего
          // нет», и это разные утверждения.
          const целиком = column !== undefined && column.rows.length === column.total;
          const сумма =
            целиком && column.rows.length > 0
              ? column.rows.reduce((sum, d) => sum + (d.amount ?? 0), 0)
              : null;

          return (
            <section
              key={stage}
              className={`board__col${over === stage ? " board__col--over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                бросить(stage);
              }}
              aria-label={`${label(STAGE, stage)}, сделок ${column?.total ?? 0}`}
            >
              <header className="board__head">
                <span className={`board__dot ${тон(funnel, stage)}`} aria-hidden="true" />
                <span className="board__name">{label(STAGE, stage)}</span>
                <span className="board__count mono">{column?.total ?? "…"}</span>
              </header>

              {/* Сумма показывается только когда в колонке видно всё.
                  Сумма по сорока карточкам из ста — не сумма стадии,
                  а число, которое выглядит как сумма стадии. */}
              <p className="board__sum mono">
                {сумма !== null
                  ? money(сумма, "RUB")
                  : column === undefined
                    ? ""
                    : column.total === 0
                      ? ""
                      : `показаны ${column.rows.length} из ${column.total}`}
              </p>

              <div className="board__cards">
                {columns === null && <p className="board__idle">Читаем…</p>}
                {column?.rows.length === 0 && <p className="board__idle">Пусто</p>}

                {column?.rows.map((deal) => (
                  <Card key={deal.id} deal={deal} now={now} onDrag={() => setDrag(deal)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="admin-hint">
        Карточка переносится мышью — стадия меняется сразу, а полоса внизу семь секунд
        держит отмену. Перевод в отказ спросит причину: без неё портал не примет перенос.
        С клавиатуры стадия меняется в самой сделке — перетаскивание клавишами не работает
        нигде, и доска не должна быть единственным способом.
      </p>

      {asking && (
        <Reason
          title={asking.deal.title}
          stage={asking.stage}
          onCancel={() => setAsking(null)}
          onDone={(reason) => {
            setAsking(null);
            void перенести(asking.deal, asking.stage, reason);
          }}
        />
      )}
    </>
  );
}

/**
 * Цвет квадратика у названия стадии.
 *
 * По смыслу, а не по месту в ряду: у воронок разное число стадий, и пятый
 * цвет, назначенный пятой колонке, означал бы в продажах «проиграна»,
 * а в сервисе — «закрыта».
 */
function тон(funnel: Pipeline, stage: string): string {
  if (funnel.lostStages.includes(stage)) return "board__dot--stop";
  if (funnel.wonStages.includes(stage)) return "board__dot--won";
  if (funnel.stages[0] === stage) return "board__dot--first";
  return "board__dot--work";
}

function Card({ deal, now, onDrag }: { deal: DealRow; now: number; onDrag: () => void }) {
  const дней = Math.floor((now - new Date(deal.updatedAt).valueOf()) / 86_400_000);

  return (
    <Link
      className="card"
      href={`/admin/deals/${deal.id}/`}
      draggable
      onDragStart={onDrag}
      // Перетаскивание ссылки браузер по умолчанию понимает как перенос
      // адреса — карточка уезжала бы в адресную строку соседней вкладки.
      onDragEnd={(e) => e.preventDefault()}
    >
      <span className="card__title">{deal.title}</span>
      <span className="card__client">{deal.clientName}</span>

      <span className="card__row">
        <span className="card__sum mono">{money(deal.amount, deal.currency)}</span>
        {deal.owner && <Avatar name={deal.owner} size="s" />}
      </span>

      {/* «Без изменений», а не «в стадии»: портал хранит время последней
          правки карточки, а не время перехода. Разница видна на сделке,
          которую вчера правили, не двигая, — «1 день в стадии» было бы
          неправдой, а «без изменений 1 день» правда. */}
      {Number.isFinite(дней) && дней >= 1 && (
        <span className={`card__idle mono${дней >= 14 ? " card__idle--long" : ""}`}>
          без изменений {дней} {plural(дней, "день", "дня", "дней")}
        </span>
      )}
    </Link>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Список

function List({
  pipeline,
  clientId,
  owner,
}: {
  pipeline: string;
  clientId: string;
  owner: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(0);

  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);
  const { data, error, loading } = useLoad<Page<DealRow>>(
    () => deals({ pipeline, stage, clientId, owner }, page),
    `${pipeline}:${stage}:${clientId}:${owner}:${page}`,
  );

  const stages = useMemo(
    () => funnels?.find((f) => f.pipeline === pipeline)?.stages ?? [],
    [funnels, pipeline],
  );

  return (
    <>
      {stages.length > 0 && (
        <div className="chips">
          <span className="chips__label mono">Стадия</span>
          {["", ...stages].map((s) => (
            <span key={s || "all"} className={`chip${stage === s ? " chip--on" : ""}`}>
              <button
                type="button"
                className="chip__pick"
                aria-pressed={stage === s}
                onClick={() => {
                  setStage(s);
                  setPage(0);
                }}
              >
                {s ? label(STAGE, s) : "Все"}
              </button>
            </span>
          ))}
        </div>
      )}

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data?.items.length === 0 && <Empty>Сделок с таким отбором нет.</Empty>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-scroll">
            <table className="admin-table admin-table--pick">
              <thead>
                <tr>
                  <th>Сделка</th>
                  <th>Клиент</th>
                  <th>Воронка</th>
                  <th>Стадия</th>
                  <th>Сумма</th>
                  <th>Ответственный</th>
                  <th>Изменена</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} onClick={() => router.push(`/admin/deals/${row.id}/`)}>
                    <td>
                      <span className="row__name">{row.title}</span>
                      {row.productSlug && <span className="row__under mono">{row.productSlug}</span>}
                    </td>
                    <td>
                      <Link
                        href={`/admin/clients/${row.clientId}/`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.clientName}
                      </Link>
                    </td>
                    <td className="tight">{label(PIPELINE, row.pipeline)}</td>
                    <td className="tight">
                      <State value={row.stage} dict={STAGE} />
                    </td>
                    <td className="tight mono">{money(row.amount, row.currency)}</td>
                    <td className="tight">
                      {row.owner || <span className="nobody">не назначен</span>}
                    </td>
                    <td className="tight mono">{when(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="under">
            <span className="under__count mono">
              Показаны {data.page * data.size + 1}–{data.page * data.size + data.items.length} из{" "}
              {data.total}
            </span>

            {data.pages > 1 && (
              <span className="under__pager">
                <button
                  className="btn btn--small"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </button>
                <button
                  className="btn btn--small"
                  disabled={page + 1 >= data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Дальше
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
