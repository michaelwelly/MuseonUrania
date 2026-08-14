"use client";

import { clientKinds } from "@/lib/admin";
import ClientEditor from "../ClientEditor";
import { useLoad } from "../../ui";

export default function NewClient() {
  const { data: kinds } = useLoad<string[]>(clientKinds);

  return (
    <>
      <div className="admin-head">
        <h1>Новый клиент</h1>
      </div>
      <p className="admin-hint">
        Портал не ищет совпадения по наименованию сам: слить две карточки потом можно,
        разделить ошибочно слитые — уже нет. Перед тем как заводить, поищите в списке.
      </p>

      <ClientEditor kinds={kinds ?? ["company", "person"]} />
    </>
  );
}
