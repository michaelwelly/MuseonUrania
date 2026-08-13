"use client";

import { use } from "react";
import { product, type Product } from "@/lib/admin";
import ProductEditor from "../ProductEditor";
import { Note, Published, useLoad } from "../../ui";

export default function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useLoad<Product>(() => product(id), [id]);

  return (
    <>
      <div className="admin-head">
        <h1>{data?.name ?? "Изделие"}</h1>
        {data && <Published on={data.published} />}
      </div>

      <Note kind="error">{error}</Note>
      {loading && !data && <p className="muted">Загружаем…</p>}

      {/* key по id: без него React переиспользовал бы состояние формы
          при переходе от одного изделия к другому и показал бы чужие поля. */}
      {data && <ProductEditor key={data.id} existing={data} />}
    </>
  );
}
