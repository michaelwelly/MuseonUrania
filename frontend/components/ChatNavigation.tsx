"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, confirmChatNavigation, type NavigationAction } from "@/lib/submit";
import styles from "./VedalinaChat.module.css";

export function safeChatDestination(action: NavigationAction): boolean {
  return action.type === "document"
    ? /^\/api\/public\/v1\/documents\/[a-z0-9-]+\/file$/.test(action.url)
    : action.type === "navigate" && /^(?:\/|\/(?:about|products|production|service|documents|contacts|news)(?:\/[a-z0-9-]+)*\/?)$/.test(action.url);
}

export default function ChatNavigation({ actions, visitor, messageId }: {
  actions: NavigationAction[];
  visitor: string;
  messageId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<NavigationAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pending || busy || !safeChatDestination(pending)) return;
    // Reserve a tab during the user gesture, before the asynchronous request.
    // The document opens separately so the conversation remains visible.
    const documentTab = pending.type === "document" ? window.open("about:blank", "_blank") : null;
    if (pending.type === "document" && !documentTab) {
      setError("Разрешите открытие новой вкладки для документа.");
      return;
    }
    if (documentTab) documentTab.opener = null;
    setBusy(true);
    setError(null);
    const accepted = await confirmChatNavigation(visitor, messageId, pending);
    setBusy(false);
    if (!accepted) {
      documentTab?.close();
      setError("Переход не подтверждён. Попробуйте ещё раз.");
      return;
    }
    if (documentTab) documentTab.location.href = `${apiUrl}${pending.url}`;
    else router.push(pending.url);
    setPending(null);
  }

  return <div className={styles.navigation}>
    {actions.filter(safeChatDestination).map(action => (
      <button key={action.url} type="button" className={styles.ticketOpen} disabled={busy}
        onClick={() => { setPending(action); setError(null); }}>
        Открыть: {action.title}
      </button>
    ))}
    {pending && <div role="group" aria-label="Подтверждение перехода" className={styles.navigationConfirm}>
      <p>Открыть «{pending.title}»? {pending.type === "document" ? "Документ откроется в новой вкладке." : "Переписка сохранится, чат останется открытым."}</p>
      <button type="button" className={styles.ticketSend} onClick={() => void confirm()} disabled={busy}>
        {busy ? "Подтверждаем…" : "Подтвердить переход"}
      </button>{" "}
      <button type="button" className={styles.ticketCancel} disabled={busy} onClick={() => setPending(null)}>Отмена</button>
    </div>}
    {error && <p role="alert" className={styles.ticketError}>{error}</p>}
  </div>;
}
