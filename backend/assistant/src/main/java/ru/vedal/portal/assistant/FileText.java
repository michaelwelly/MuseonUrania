package ru.vedal.portal.assistant;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.text.PDFTextStripper;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.zip.ZipInputStream;

/**
 * Текст из файла: PDF и DOCX.
 *
 * <p><b>Зачем.</b> Датащит, буклет или каталог приезжают в портал файлом,
 * а индексируется текст. Без этого шага документ виден Ведалине только
 * названием карточки — то есть на вопрос «что внутри» ответить нечем.
 *
 * <p><b>Что здесь считается текстом.</b> Ровно то, что человек читает
 * глазами: содержимое страниц PDF и содержимое тела DOCX, включая ячейки
 * таблиц. Оформление, колонтитулы, поля форм и рисунки не извлекаются —
 * в контекст модели они попадали бы шумом, а не сведениями.
 *
 * <p><b>Чего здесь нет намеренно.</b> Ни OCR, ни распознавания сканов.
 * PDF из сканированных страниц отдаёт пустой текст, и это честный ответ:
 * такой документ в индекс не попадает, а не попадает туда полупустым.
 * {@link #of} на нём возвращает пустую строку, вызывающий видит «текста нет»
 * и не платит за эмбеддинги ни разу.
 *
 * <p><b>Про чужие файлы.</b> Разбор — это чтение недоверенных данных, и обе
 * реализации здесь обрезаны по верхней границе: размер распакованного
 * содержимого DOCX и длина итогового текста. Архив, который в сжатом виде
 * весит килобайты, а в распакованном гигабайты, — известный способ уронить
 * приложение, и он останавливается счётчиком, а не надеждой.
 */
final class FileText {

    /**
     * Предел длины извлечённого текста.
     *
     * <p>Не про безопасность, а про деньги: каждые полторы тысячи знаков —
     * это фрагмент, то есть вызов модели. Двести тысяч знаков — примерно
     * стостраничный каталог, полторы сотни фрагментов; всё, что длиннее,
     * почти наверняка ошибка загрузки, а не документ VEDAL.
     */
    static final int MAX_CHARACTERS = 200_000;

    /**
     * Предел распакованного размера части DOCX.
     *
     * <p>DOCX — это ZIP, и степень сжатия XML доходит до тысячекратной.
     * Читать его до конца, доверяя заголовку архива, значит согласиться
     * прочитать в память сколько угодно.
     */
    static final long MAX_UNPACKED_BYTES = 64L * 1024 * 1024;

    /** Часть DOCX, в которой лежит тело документа. */
    private static final String DOCX_BODY = "word/document.xml";

    private FileText() {}

    /**
     * Умеем ли мы прочитать такой файл.
     *
     * <p>Смотрим на расширение, а не на объявленный тип содержимого: тип
     * приходит от того, кто загружал, и у половины браузеров он
     * {@code application/octet-stream}. Расширение задаёт сам портал, когда
     * складывает файл в хранилище.
     *
     * <p>Старый {@code .doc} (бинарный формат до 2007 года) сюда не входит.
     * Это не недосмотр: его разбор — отдельная библиотека ради формата,
     * которого у заказчика в материалах для сайта не встречалось. Такой
     * файл индексируется карточкой, как и раньше.
     */
    static boolean supports(String filename) {
        var lower = lower(filename);
        return lower.endsWith(".pdf") || lower.endsWith(".docx");
    }

    /**
     * Прочитать текст файла.
     *
     * <p>Поток закрывает вызывающий: он же его и открыл, и он же знает,
     * что делать с отказом хранилища.
     *
     * @return текст; пустая строка, если файла такого вида мы не читаем
     *         или читаемого текста в нём нет
     * @throws IOException файл не разбирается: битый, зашифрованный
     *                     или не тот, за кого себя выдаёт
     */
    static String of(String filename, InputStream data) throws IOException {
        var lower = lower(filename);
        if (lower.endsWith(".pdf")) return limit(fromPdf(data));
        if (lower.endsWith(".docx")) return limit(fromDocx(data));
        return "";
    }

    /**
     * PDF.
     *
     * <p>Порядок чтения — по расположению на странице, а не по порядку
     * команд внутри файла. Разница видна на двухколоночном буклете:
     * без сортировки строки левой и правой колонки чередуются, и
     * получается текст, в котором ни одно предложение не дочитывается
     * до конца.
     *
     * <p>Зашифрованный файл роняет разбор исключением, а не возвращает
     * пустоту: «документ, из которого ничего не извлеклось» и «документ,
     * который нам не открыть» — разные события, и второе стоит увидеть
     * в журнале.
     */
    private static String fromPdf(InputStream data) throws IOException {
        try (var document = Loader.loadPDF(new RandomAccessReadBuffer(data))) {
            var stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            // Абзац отделяется пустой строкой: нарезка ищет границу
            // фрагмента именно по ней.
            stripper.setParagraphEnd("\n\n");
            return stripper.getText(document);
        } catch (RuntimeException e) {
            // PDFBox на битой структуре бросает и непроверяемые исключения.
            // Для вызывающего это то же самое событие: файл не прочитан.
            throw new IOException("PDF не разбирается: " + e.getMessage(), e);
        }
    }

    /**
     * DOCX.
     *
     * <p><b>Почему без библиотеки офисных форматов.</b> DOCX — это ZIP,
     * внутри которого лежит XML, и весь нужный нам текст — это содержимое
     * элементов {@code w:t}. Полноценная библиотека тянет за собой
     * собственный разбор XML-схем и десяток мегабайт в образ ради одного
     * формата, который мы только читаем и только ради текста.
     *
     * <p>Абзац ({@code w:p}) даёт пустую строку, {@code w:tab} — пробел,
     * {@code w:br} — перевод строки. Ячейки таблиц отдельно не размечаются:
     * их текст лежит в тех же {@code w:p}, и в индексе строка таблицы
     * выглядит как строка текста — ровно то, что нужно.
     */
    private static String fromDocx(InputStream data) throws IOException {
        try (var zip = new ZipInputStream(data)) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (!DOCX_BODY.equals(entry.getName())) continue;
                return readBody(new Bounded(zip, MAX_UNPACKED_BYTES));
            }
        }
        throw new IOException("В файле нет части " + DOCX_BODY
                + " — это не DOCX или архив повреждён");
    }

    private static String readBody(InputStream body) throws IOException {
        var text = new StringBuilder();
        try {
            var reader = xml().createXMLStreamReader(body);
            var inText = false;
            while (reader.hasNext()) {
                switch (reader.next()) {
                    case XMLStreamConstants.START_ELEMENT -> {
                        switch (reader.getLocalName()) {
                            case "t" -> inText = true;
                            case "tab" -> text.append(' ');
                            case "br", "cr" -> text.append('\n');
                            default -> { }
                        }
                    }
                    case XMLStreamConstants.CHARACTERS -> {
                        if (inText) text.append(reader.getText());
                    }
                    case XMLStreamConstants.END_ELEMENT -> {
                        switch (reader.getLocalName()) {
                            case "t" -> inText = false;
                            case "p" -> text.append("\n\n");
                            default -> { }
                        }
                    }
                    default -> { }
                }
                if (text.length() > MAX_CHARACTERS) break;
            }
            reader.close();
        } catch (XMLStreamException e) {
            throw new IOException("Тело DOCX не разбирается: " + e.getMessage(), e);
        }
        return text.toString();
    }

    /**
     * Разбор XML без внешних сущностей.
     *
     * <p>DOCX приезжает от того, кто его загрузил. Разборщик со включёнными
     * DTD прочитает объявленную в файле сущность — в том числе ссылающуюся
     * на файл на диске портала, — и вернёт её содержимое в текст, который
     * мы честно положим в индекс и покажем посетителю.
     */
    private static XMLInputFactory xml() {
        var factory = XMLInputFactory.newInstance();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_COALESCING, true);
        return factory;
    }

    private static String limit(String text) {
        if (text == null) return "";
        var stripped = text.strip();
        return stripped.length() <= MAX_CHARACTERS ? stripped : stripped.substring(0, MAX_CHARACTERS);
    }

    private static String lower(String filename) {
        return filename == null ? "" : filename.toLowerCase(Locale.ROOT);
    }

    /** Поток, который отказывается отдать больше, чем разрешено. */
    private static final class Bounded extends FilterInputStream {

        private final long limit;
        private long read;

        private Bounded(InputStream in, long limit) {
            super(in);
            this.limit = limit;
        }

        @Override
        public int read() throws IOException {
            var value = super.read();
            if (value >= 0) count(1);
            return value;
        }

        @Override
        public int read(byte[] buffer, int off, int len) throws IOException {
            var got = super.read(buffer, off, len);
            if (got > 0) count(got);
            return got;
        }

        private void count(long more) throws IOException {
            read += more;
            if (read > limit) {
                throw new IOException("Распакованное тело DOCX больше " + limit
                        + " байт — файл не индексируется");
            }
        }
    }
}
