"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clients as findClients,
  convertLead,
  eraseLeadData,
  lead as loadLead,
  pipelines as loadPipelines,
  triageLead,
  type ClientRow,
  type Lead,
  type Page,
  type Pipeline,
} from "@/lib/admin";
import EraseData from "../EraseData";
import History from "../History";
import OwnerField from "../OwnerField";
import { CloseIcon } from "../icons";
import { FORM, LEAD_SOURCE, LEAD_STATUS, PIPELINE, label } from "../labels";
import { Field, Note, Segments, message, money, useLoad, when } from "../ui";
import { useWho } from "../who";

// Разбор заявки.
//
// Панель справа во всю высоту, а не карточка под таблицей. Причина замерена:
// карточка под таблицей выталкивала список вниз, и после сохранения человек
// оказывался посреди страницы, не понимая, где строка, которую он только что
// разобрал. Панель оставляет список на месте — видно, откуда пришли и что
// будет следующим.
//
// ───────────────────────────────────────────────────────────────────────────
// Ответственный здесь один
//
// Раньше их было два: одно поле в «Сохранить разбор», другое в «Завести
// сделку», и из интерфейса не следовало, какое решает, кто ведёт сделку.
// Это не мелочь оформления: заявку берёт человек, и сделка, выросшая из неё,
// достаётся ему же. Расхождение между этими двумя полями означало сделку,
// заведённую на одного, а числящуюся за другим.
//
// Теперь поле одно и отвечает на оба вопроса сразу. Подставлен вошедший:
// разбирает заявку тот, кто её открыл, и в девяти случаях из десяти
// подставленное значение и есть верное.
//
// ───────────────────────────────────────────────────────────────────────────
// Клиент не выбирается сам
//
// Совпадения по названию портал показывает, но ни одно не отмечено заранее.
// Две ошибки здесь стоят по-разному: лишняя карточка клиента сливается
// с настоящей потом, а заявка, привязанная к чужой карточке, уже приписала
// чужой компании чужую переписку — и разделить их обратно нечем.

type Очередь = { list: readonly string[]; at: number; onGo: (at: number) => void };

export function Triage({
  id,
  statuses,
  queue,
  onClose,
  onSaved,
}: {
  id: string;
  statuses: readonly string[];
  /** Разбор пачкой: «2 из 5» и переход к следующей после сохранения. */
  queue?: Очередь;
  onClose: () => void;
  onSaved: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { data, error, loading, setError } = useLoad<Lead>(() => loadLead(id), id);

  // Escape закрывает панель отовсюду, включая поля ввода: она перекрывает
  // список целиком, и «уйти» — первое, что человек пробует.
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  // Фокус уводится в панель: без этого Tab продолжает ходить по таблице
  // под затемнением, и с клавиатуры панель просто не существует.
  useEffect(() => {
    panel.current?.focus();
  }, [id]);

  return (
    <div
      className="veil veil--right"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet-right"
        role="dialog"
        aria-modal="true"
        aria-label="Разбор заявки"
        tabIndex={-1}
        ref={panel}
      >
        <div className="sheet-right__head">
          <div className="sheet-right__eyebrow mono">
            Заявка {id.slice(0, 8)}
            {data && <> · {when(data.createdAt)}</>}
            {queue && queue.list.length > 1 && (
              <>
                {" · "}
                {queue.at + 1} из {queue.list.length}
              </>
            )}
          </div>
          <h2 className="sheet-right__title">{data?.name ?? "Читаем заявку…"}</h2>
          {data && (
            <p className="sheet-right__sub">
              {[data.company, label(FORM, data.form), label(LEAD_SOURCE, data.source)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <button
            type="button"
            className="sheet-right__close"
            onClick={onClose}
            aria-label="Закрыть разбор"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="sheet-right__body">
          <Note kind="error">{error}</Note>
          {loading && !data && <p className="muted">Загружаем…</p>}

          {data && (
            <Form
              key={data.id}
              lead={data}
              statuses={statuses}
              queue={queue}
              onError={setError}
              onSaved={onSaved}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Form({
  lead,
  statuses,
  queue,
  onError,
  onSaved,
  onClose,
}: {
  lead: Lead;
  statuses: readonly string[];
  queue?: Очередь;
  onError: (message: string | null) => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const who = useWho();
  const { data: funnels } = useLoad<Pipeline[]>(loadPipelines);

  const [status, setStatus] = useState(lead.status);
  // Ответственный подставлен вошедшим: разбирает тот, кто открыл.
  const [owner, setOwner] = useState(lead.owner ?? who.actor);
  const [pipeline, setPipeline] = useState("sales");
  const [amount, setAmount] = useState<string>("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "status" | "deal">("");

  // Совпадения по названию компании — чтобы менеджер увидел, что такой
  // клиент уже есть. Ни одно не отмечено: выбор делает человек.
  const запрос = (lead.company ?? lead.name).trim();
  const { data: похожие } = useLoad<Page<ClientRow>>(
    () => (запрос ? findClients(запрос, 0, 4) : Promise.resolve(пусто())),
    запрос,
  );

  const дальше = () => {
    onSaved();
    if (queue && queue.at + 1 < queue.list.length) queue.onGo(queue.at + 1);
    else onClose();
  };

  async function saveStatus() {
    setBusy("status");
    onError(null);
    try {
      await triageLead(lead.id, status, owner.trim() || null);
      дальше();
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy("");
    }
  }

  async function convert() {
    setBusy("deal");
    onError(null);
    try {
      // Ответственный уезжает и в заявку, и в сделку одним значением:
      // разойтись им теперь нечем.
      await triageLead(lead.id, status, owner.trim() || null);
      const deal = await convertLead(lead.id, {
        clientId,
        pipeline,
        title: null,
        amount: amount === "" ? null : Number(amount),
        owner: owner.trim(),
      });
      onSaved();
      router.push(`/admin/deals/${deal.id}/`);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy("");
    }
  }

  const разобрана = lead.dealId !== null;

  return (
    <>
      <p className="triage__message">{lead.message}</p>

      <dl className="pairs">
        <div className="pairs__row">
          <dt>Телефон</dt>
          <dd className="mono">{lead.phone}</dd>
        </div>
        <div className="pairs__row">
          <dt>Почта</dt>
          <dd className="mono">{lead.email}</dd>
        </div>
        {lead.productSlug && (
          <div className="pairs__row">
            <dt>Изделие</dt>
            <dd className="mono">{lead.productSlug}</dd>
          </div>
        )}
        {lead.serialNumber && (
          <div className="pairs__row">
            <dt>Серийный номер</dt>
            <dd className="mono">{lead.serialNumber}</dd>
          </div>
        )}
        <div className="pairs__row">
          <dt>Согласие</dt>
          <dd className="mono">
            {lead.consentVersion} от {when(lead.consentAt)}
          </dd>
        </div>
      </dl>

      <div className="triage__field">
        <span className="triage__label">Статус</span>
        <Segments
          label="Статус заявки"
          value={status}
          options={statuses}
          dict={LEAD_STATUS}
          onChange={setStatus}
        />
      </div>

      <OwnerField
        value={owner}
        onChange={(login) => setOwner(login ?? "")}
        hint="Один на заявку и на сделку из неё. Пусто — снять ответственного."
      />

      {разобрана ? (
        <p className="admin-hint">
          Заявка уже разобрана в сделку — второй раз этого не делают, и портал откажет.
          Здесь можно поменять статус и ответственного.{" "}
          <a href={`/admin/deals/${lead.dealId}/`}>Открыть сделку →</a>
        </p>
      ) : (
        <>
          <div className="triage__field">
            <span className="triage__label">Клиент</span>

            {(похожие?.items.length ?? 0) > 0 && (
              <p className="triage__note">
                Похожие карточки уже есть. Ни одна не выбрана: привязать заявку к чужой
                компании — ошибка, которую нечем разделить обратно, а лишнюю карточку
                можно слить потом.
              </p>
            )}

            <div className="picker">
              <label className="picker__row">
                <input
                  type="radio"
                  name={`client-${lead.id}`}
                  checked={clientId === null}
                  onChange={() => setClientId(null)}
                />
                <span>Завести новую карточку из этой заявки</span>
              </label>

              {похожие?.items.map((c) => (
                <label key={c.id} className="picker__row">
                  <input
                    type="radio"
                    name={`client-${lead.id}`}
                    checked={clientId === c.id}
                    onChange={() => setClientId(c.id)}
                  />
                  <span>
                    {c.name}
                    {c.inn && <span className="mono"> · ИНН {c.inn}</span>}
                    <span className="muted"> · сделок {c.deals}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid2">
            <div className="triage__field">
              <span className="triage__label">Воронка</span>
              <Segments
                label="Воронка сделки"
                value={pipeline}
                options={(funnels ?? []).map((f) => f.pipeline)}
                dict={PIPELINE}
                onChange={setPipeline}
              />
            </div>

            <Field label="Сумма" hint="Пусто — сумма ещё не названа.">
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>

          {amount !== "" && (
            <p className="triage__sum mono">{money(Number(amount), "RUB")}</p>
          )}
        </>
      )}

      <div className="triage__actions">
        {!разобрана && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy !== ""}
            onClick={() => void convert()}
          >
            {busy === "deal" ? "Заводим…" : "Завести сделку"}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={busy !== ""}
          onClick={() => void saveStatus()}
        >
          {busy === "status" ? "Сохраняем…" : "Только статус"}
        </button>
      </div>

      <p className="admin-hint">
        Сделка встанет в первую стадию воронки. Заявка останется в списке — со ссылкой
        на сделку, — а история переписки переедет вместе с ней. Разбирается заявка один
        раз: это ограничение схемы, а не проверка формы.
      </p>

      <History of="leads" id={lead.id} />

      {/* Обращение субъекта персональных данных исполняется здесь: это
          единственный экран, где они на виду целиком. */}
      <EraseData
        what="имя, телефон, почта, текст обращения, вся история переписки и разговор в чате, если он был"
        erasedAt={lead.erasedAt}
        erase={() => eraseLeadData(lead.id)}
        onDone={() => {
          onSaved();
          onClose();
        }}
      />
    </>
  );
}

function пусто(): Page<ClientRow> {
  return { items: [], page: 0, size: 0, total: 0, pages: 0 };
}
