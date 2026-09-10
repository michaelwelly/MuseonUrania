"use client";

import ProductEditor from "../ProductEditor";

export default function NewProduct() {
  return (
    <>
      <div className="admin-head">
        <h1>Новое изделие</h1>
      </div>
      <p className="admin-hint">
        Новое изделие сохраняется как черновик. На сайте оно появится только после
        публикации из списка продукции.
      </p>
      <ProductEditor />
    </>
  );
}
