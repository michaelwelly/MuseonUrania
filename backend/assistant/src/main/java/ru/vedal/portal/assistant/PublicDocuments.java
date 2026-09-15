package ru.vedal.portal.assistant;

/**
 * Говорит ли Ведалина посетителю о документах.
 *
 * <p><b>Зачем понадобилось.</b> Публичный раздел документов на сайте скрыт
 * решением заказчика (на фронте — {@code NEXT_PUBLIC_DOCUMENTS_ENABLED=false}).
 * Ассистент же продолжал вести туда: кнопка «Найти документ», ссылка
 * на «/documents/» под ответом, выдержки из PDF в тексте модели. Посетитель
 * получал приглашение в раздел, которого на сайте нет, — и файлы, которые
 * заказчик решил пока не показывать.
 *
 * <p><b>Почему одна настройка, а не правка в каждом месте.</b> Документы
 * попадают в ответ пятью путями: кнопка, прямая выдача файла, поиск по словам,
 * индекс pgvector и тексты страниц сайта. Прошитое по месту «не показывать»
 * пришлось бы потом так же по месту возвращать, и один забытый путь вернул бы
 * документы в ответ молча. Здесь их включают обратно одной переменной.
 *
 * <p><b>Почему прячется только от посетителя.</b> Скрыт публичный раздел.
 * Сотрудник видит перечень в админке, и отнимать документы у его ассистента
 * решением про сайт незачем. Тексты, общие для всех (страницы сайта, кнопки,
 * отказы), от области не зависят — их читает посетитель.
 *
 * @param enabled {@code true} — документы показываются, как до скрытия раздела.
 */
public record PublicDocuments(boolean enabled) {

    /** Документы показываются посетителю. */
    public static final PublicDocuments SHOWN = new PublicDocuments(true);

    /** Раздел скрыт: ни кнопки, ни ссылок, ни выдержек из файлов. */
    public static final PublicDocuments HIDDEN = new PublicDocuments(false);

    /** Адрес раздела на сайте. */
    static final String SECTION = "/documents";

    /** Адрес публичной выдачи файлов документов. */
    static final String FILES = "/api/public/v1/documents/";

    /** Прятать ли документы от этой области. */
    public boolean hiddenFrom(LlmEngine.Scope scope) {
        return !enabled && scope == LlmEngine.Scope.PUBLIC;
    }

    /**
     * Прятать ли этот источник от этой области.
     *
     * <p>Проверяется и вид, и адрес. Вид ловит карточку документа, адрес —
     * страницу раздела (у неё вид {@code page}) и файл, записанный в индекс
     * под чужим видом: индекс хранит строки, собранные до скрытия раздела,
     * и полагаться на один только вид значит полагаться на то, что никто
     * никогда не положил туда ничего иначе.
     */
    public boolean hides(LlmEngine.Source source, LlmEngine.Scope scope) {
        return hiddenFrom(scope) && isDocument(source);
    }

    static boolean isDocument(LlmEngine.Source source) {
        var url = source.url() == null ? "" : source.url();
        return "document".equals(source.kind())
                || url.startsWith(SECTION)
                || url.startsWith(FILES);
    }
}
