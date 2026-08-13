"use client";

import ProductEditor from "../ProductEditor";

export default function NewProduct() {
  return (
    <>
      <div className="admin-head">
        <h1>Новое изделие</h1>
      </div>
      <p className="admin-hint">
        Заводится черновиком: на сайте его не будет, пока вы не опубликуете его отдельным
        действием из списка. Черновик, случайно уехавший на сайт, снимается дольше, чем
        публикуется.
      </p>
      <ProductEditor />
    </>
  );
}
