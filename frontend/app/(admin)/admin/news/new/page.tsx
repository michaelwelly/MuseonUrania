"use client";

import NewsEditor from "../NewsEditor";

export default function NewNews() {
  return (
    <>
      <div className="admin-head">
        <h1>Новый материал</h1>
      </div>
      <p className="admin-hint">
        Создаётся черновиком. Без даты в ленте публикация будет отклонена — это ограничение
        схемы <code>news_published_needs_date</code>.
      </p>
      <NewsEditor />
    </>
  );
}
