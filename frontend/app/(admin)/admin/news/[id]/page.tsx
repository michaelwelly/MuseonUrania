"use client";

import { use } from "react";
import { newsItem, type News } from "@/lib/admin";
import NewsEditor from "../NewsEditor";
import { Note, Published, useLoad } from "../../ui";

export default function EditNews({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useLoad<News>(() => newsItem(id), [id]);

  return (
    <>
      <div className="admin-head">
        <h1>{data?.title ?? "Материал"}</h1>
        {data && <Published on={data.published} />}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}
      {data && <NewsEditor key={data.id} existing={data} />}
    </>
  );
}
