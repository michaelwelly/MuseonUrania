"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pcm16, voiceRequest } from "@/lib/voice";
import styles from "./VedalinaVoice.module.css";

type Consent = { consent: boolean; requestConsent: () => void };

export function VoiceInput({ consent, requestConsent, onTranscript }: Consent & { onTranscript: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const stopTracks = useCallback(() => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; }, []);
  const cancel = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopTracks(); request.current?.abort();
    recorder.current = null;
  }, [stopTracks]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { cancel(); setState("idle"); } };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); cancel(); };
  }, [cancel]);

  async function start() {
    if (!consent) { requestConsent(); return; }
    if (state !== "idle") return;
    const token = ++generation.current;
    setError(""); setState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Запись недоступна в этом браузере. Откройте сайт по HTTPS или напишите сообщение.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      if (token !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t));
      const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      let chunks: Blob[] = [];
      let size = 0;
      recording.ondataavailable = e => {
        size += e.data.size;
        if (size > 4_000_000) { cancel(); chunks = []; setState("idle"); setError("Запись слишком большая. Попробуйте короче."); }
        else chunks.push(e.data);
      };
      recording.onerror = () => { cancel(); setState("idle"); setError("Запись прервалась. Попробуйте ещё раз."); };
      recording.onstop = async () => {
        if (token !== generation.current) return;
        stopTracks();
        if (timer.current) clearTimeout(timer.current);
        setState("sending");
        const controller = new AbortController(); request.current = controller;
        const deadline = setTimeout(() => controller.abort(), 45000);
        let context: AudioContext | undefined;
        try {
          context = new AudioContext();
          const decoded = await context.decodeAudioData(await new Blob(chunks, { type: recording.mimeType }).arrayBuffer());
          chunks = [];
          if (token !== generation.current) return;
          const pcm = pcm16(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate);
          const response = await voiceRequest("recognize", pcm, "application/octet-stream", controller.signal);
          const result = await response.json() as { text: string };
          if (token !== generation.current) return;
          if (!result.text?.trim()) throw new Error("Речь не разобрана. Попробуйте ещё раз или напишите сообщение.");
          onTranscript(result.text);
        } catch (e) {
          if (token === generation.current) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Распознавание заняло слишком долго. Попробуйте ещё раз.");
        } finally {
          clearTimeout(deadline); await context?.close();
          if (token === generation.current) setState("idle");
        }
      };
      recording.start(1000); setState("recording");
      timer.current = setTimeout(() => { if (recording.state === "recording") recording.stop(); }, 29000);
    } catch (e) {
      if (token !== generation.current) return;
      cancel(); setState("idle");
      setError(typeof e === "object" && e !== null && "name" in e && e.name === "NotAllowedError" ? "Доступ к микрофону не разрешён. Можно написать сообщение." : e instanceof Error ? e.message : "Не удалось начать запись.");
    }
  }

  return <div className={styles.capture}>
    <button type="button" className={styles.mic} aria-label={state === "recording" ? "Остановить запись" : "Записать голосовое сообщение"}
      aria-pressed={state === "recording"} disabled={state === "sending" || state === "starting"}
      onClick={() => state === "recording" ? recorder.current?.stop() : void start()}>
      {state === "recording" ? "■" : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8"/></svg>}
    </button>
    {(state !== "idle" || error) && <div className={styles.notice}>
      <span role={error ? "alert" : "status"}>{error || (state === "recording" ? "Идёт запись · до 30 секунд" : state === "starting" ? "Разрешите доступ к микрофону" : "Отправляю на распознавание…")}</span>
      {state !== "idle" && <button type="button" onClick={() => { cancel(); setState("idle"); }}>Отменить запись</button>}
    </div>}
  </div>;
}

export function VoiceReply({ text, consent, requestConsent }: Consent & { text: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { request.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  async function load() {
    if (!consent) { requestConsent(); return; }
    if (loading) return;
    setLoading(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 95000);
    try {
      const response = await voiceRequest("synthesize", JSON.stringify({ text }), "application/json", controller.signal);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl.current = URL.createObjectURL(blob); setUrl(objectUrl.current);
    } catch { if (!controller.signal.aborted) setError("Озвучивание недоступно. Ответ можно прочитать."); else setError("Озвучивание прервано. Попробуйте ещё раз."); }
    finally { clearTimeout(timeout); setLoading(false); }
  }
  return <div className={styles.reply}>
    {url ? <audio ref={audio} controls preload="metadata" src={url} aria-label="Озвученный ответ Ведалины"
      onPlay={() => document.querySelectorAll("audio").forEach(other => { if (other !== audio.current) other.pause(); })}
      onError={() => setError("Не удалось воспроизвести ответ.")} /> :
      <button type="button" disabled={loading} onClick={() => void load()}>{loading ? "Готовлю озвучивание…" : "Прослушать ответ"}</button>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
