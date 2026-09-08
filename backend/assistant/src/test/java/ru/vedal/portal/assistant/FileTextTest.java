package ru.vedal.portal.assistant;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Извлечение текста из файлов.
 *
 * <p><b>Файлы здесь заведомо синтетические — про полигон, кубики и шары.</b>
 * Корпус документов заказчик ещё не передал (GitHub issue #38), а сочинять
 * содержимое датащитов VEDAL, характеристики, сертификаты и статусы
 * регистрации ради теста запрещено правилами проекта. Разбору файла всё
 * равно, что внутри, — проверяется он.
 *
 * <p><b>Почему файлы собираются, а не лежат готовыми в ресурсах.</b>
 * Двоичный файл в репозитории нельзя прочитать глазами: через полгода
 * никто не скажет, что именно в нём лежало и почему тест на него
 * рассчитывает. Здесь и содержимое, и способ сборки видны в самом тесте.
 *
 * <p>DOCX собирается Apache POI — библиотекой, которой в самом портале нет.
 * Это намеренно: файл, собранный тем же кодом, что его читает, зеленел бы
 * на любой ошибке, общей для сборки и чтения.
 */
class FileTextTest {

    // ————— что мы вообще беремся читать —————

    @Test
    void readsOnlyPdfAndDocx() {
        assertThat(FileText.supports("polygon-cube.pdf")).isTrue();
        assertThat(FileText.supports("POLYGON-CUBE.PDF")).isTrue();
        assertThat(FileText.supports("polygon-cube.docx")).isTrue();

        // Старый бинарный .doc, картинки и таблицы — не читаем, и это
        // не отказ: такой документ индексируется карточкой, как и раньше.
        assertThat(FileText.supports("polygon-cube.doc")).isFalse();
        assertThat(FileText.supports("polygon-cube.xlsx")).isFalse();
        assertThat(FileText.supports("polygon-cube.png")).isFalse();
        assertThat(FileText.supports(null)).isFalse();
    }

    @Test
    void anUnsupportedFileGivesEmptyTextInsteadOfAFailure() throws IOException {
        assertThat(FileText.of("polygon-cube.png", stream(new byte[] {1, 2, 3}))).isEmpty();
    }

    // ————— PDF —————

    @Test
    void readsTextFromPdf() throws IOException {
        var pdf = pdf(List.of(
                "Polygon: the red cube description.",
                "The cube exists only to check that a file can be read."));

        var text = FileText.of("polygon-cube.pdf", stream(pdf));

        assertThat(text).contains("red cube").contains("only to check");
    }

    // Страницы идут по порядку. Перепутанный порядок не роняет разбор
    // и не виден в журнале — он виден только тем, что выдержка обрывается
    // на полуслове.
    @Test
    void keepsPagesInOrder() throws IOException {
        var pdf = pdf(List.of("First page is about the cube."), List.of("Second page is about the sphere."));

        var text = FileText.of("polygon-cube.pdf", stream(pdf));

        assertThat(text).contains("cube").contains("sphere");
        assertThat(text.indexOf("cube")).isLessThan(text.indexOf("sphere"));
    }

    // Сканированный PDF — это картинка, текста в нём нет. Пустая строка
    // здесь честнее исключения: вызывающий увидит «текста нет», не заплатит
    // за эмбеддинги и проиндексирует документ карточкой.
    @Test
    void aPdfWithoutTextGivesEmptyString() throws IOException {
        var pdf = pdf(List.of());

        assertThat(FileText.of("polygon-cube.pdf", stream(pdf))).isEmpty();
    }

    // «Файл не прочитан» и «в файле нет текста» — разные события. Второе
    // штатное, первое стоит увидеть в журнале.
    @Test
    void aBrokenPdfFails() {
        assertThatThrownBy(() -> FileText.of("polygon-cube.pdf",
                stream("это не PDF, а строка".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IOException.class);
    }

    // ————— DOCX —————

    @Test
    void readsTextFromDocx() throws IOException {
        var docx = docx(List.of(
                "Полигон: описание зелёного шара.",
                "Шар заведён исключительно для проверки разбора файла."));

        var text = FileText.of("polygon-sphere.docx", stream(docx));

        assertThat(text).contains("зелёного шара").contains("проверки разбора файла");
    }

    // Абзац отделяется пустой строкой: по ней нарезка ищет границу
    // фрагмента. Слипшиеся абзацы режутся вслепую по знакам.
    @Test
    void separatesDocxParagraphsSoChunksCanSplitOnThem() throws IOException {
        var docx = docx(List.of("Первый абзац про кубик.", "Второй абзац про шар."));

        var text = FileText.of("polygon-shapes.docx", stream(docx));

        assertThat(text).contains("кубик.\n\nВторой");
    }

    // Таблицы в датащитах — это половина содержимого. Их текст обязан
    // доехать до индекса, пусть и без разметки.
    @Test
    void readsTextFromDocxTables() throws IOException {
        var docx = docxWithTable("Признак", "красный кубик");

        var text = FileText.of("polygon-cube.docx", stream(docx));

        assertThat(text).contains("Признак").contains("красный кубик");
    }

    @Test
    void aFileThatIsNotDocxFails() {
        assertThatThrownBy(() -> FileText.of("polygon-cube.docx",
                stream("это не DOCX, а строка".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IOException.class);
    }

    // ZIP без тела документа — либо повреждённый архив, либо не DOCX вовсе.
    // Молча вернуть пустую строку значит проиндексировать документ
    // карточкой и никогда не узнать, почему в нём «нет текста».
    @Test
    void aZipWithoutTheDocumentBodyFails() throws IOException {
        var zip = new ByteArrayOutputStream();
        try (var out = new ZipOutputStream(zip)) {
            out.putNextEntry(new ZipEntry("hello.txt"));
            out.write("полигон".getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
        }

        assertThatThrownBy(() -> FileText.of("polygon-cube.docx", stream(zip.toByteArray())))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("word/document.xml");
    }

    // Файл приезжает от того, кто его загрузил. Разборщик со включёнными
    // DTD прочитал бы объявленную внутри сущность — в том числе ссылающуюся
    // на файл на диске портала — и вернул бы её содержимое в текст, который
    // мы честно положили бы в индекс и показали посетителю.
    @Test
    void doesNotResolveExternalEntitiesFromDocx() throws IOException {
        var body = """
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE w:document [<!ENTITY secret SYSTEM "file:///etc/passwd">]>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body><w:p><w:r><w:t>Полигон: &secret;</w:t></w:r></w:p></w:body>
                </w:document>
                """;
        var zip = new ByteArrayOutputStream();
        try (var out = new ZipOutputStream(zip)) {
            out.putNextEntry(new ZipEntry("word/document.xml"));
            out.write(body.getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
        }

        // Разбор либо падает на запрещённом DTD, либо не подставляет
        // ничего. Оба исхода допустимы; недопустим один — содержимое
        // чужого файла в тексте.
        try {
            assertThat(FileText.of("polygon-cube.docx", stream(zip.toByteArray())))
                    .doesNotContain("root:");
        } catch (IOException expected) {
            assertThat(expected).hasMessageContaining("DOCX");
        }
    }

    // ————— общие пределы —————

    // Длинный текст обрезается, а не отправляется в модель целиком:
    // каждые полторы тысячи знаков — это фрагмент, то есть счёт.
    @Test
    void cutsTextThatIsLongerThanTheLimit() throws IOException {
        var paragraph = "Полигон описывает кубик исключительно ради проверки предела длины. ";
        var many = paragraph.repeat(FileText.MAX_CHARACTERS / paragraph.length() + 200);
        var docx = docx(List.of(many));

        var text = FileText.of("polygon-cube.docx", stream(docx));

        assertThat(text).hasSizeLessThanOrEqualTo(FileText.MAX_CHARACTERS);
        assertThat(text).startsWith("Полигон описывает кубик");
    }

    // Архив, который в сжатом виде весит килобайты, а в распакованном
    // гигабайты, — известный способ уронить приложение чужим файлом.
    // Останавливает его счётчик, а не надежда на добросовестность.
    @Test
    void refusesToUnpackMoreThanTheLimit() throws IOException {
        var zip = new ByteArrayOutputStream();
        try (var out = new ZipOutputStream(zip)) {
            out.putNextEntry(new ZipEntry("word/document.xml"));
            // Пробелы сжимаются почти в ничто: сто мегабайт нулевого
            // содержимого укладываются в сотню килобайт архива.
            var block = " ".repeat(1024 * 1024).getBytes(StandardCharsets.UTF_8);
            for (var at = 0; at < 100; at++) out.write(block);
            out.closeEntry();
        }

        assertThatThrownBy(() -> FileText.of("polygon-bomb.docx", stream(zip.toByteArray())))
                .isInstanceOf(IOException.class);
    }

    // ————— сборка синтетических файлов —————

    private static InputStream stream(byte[] bytes) {
        return new ByteArrayInputStream(bytes);
    }

    /**
     * PDF из страниц; каждая страница — список строк.
     *
     * <p><b>Почему в PDF латиница, а в DOCX кириллица.</b> У четырнадцати
     * встроенных гарнитур PDF нет кириллических знаков: русская строка
     * ими просто не запишется. Написать её можно, вложив в файл свой шрифт,
     * — то есть положив в репозиторий полмегабайта двоичного TTF ради
     * одного теста. Проверяется здесь наша обёртка над разбором, а не
     * поддержка кодировок в PDFBox, и цена этой проверки не должна быть
     * такой. Кириллица при этом остаётся проверенной — на DOCX, где
     * никакого шрифта не требуется.
     */
    @SafeVarargs
    private static byte[] pdf(List<String>... pages) throws IOException {
        try (var document = new PDDocument(); var bytes = new ByteArrayOutputStream()) {
            var font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            for (var lines : pages) {
                var page = new PDPage();
                document.addPage(page);
                if (lines.isEmpty()) continue;

                try (var content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(font, 12);
                    content.setLeading(16);
                    content.newLineAtOffset(50, 700);
                    for (var line : lines) {
                        content.showText(line);
                        content.newLine();
                    }
                    content.endText();
                }
            }
            document.save(bytes);
            return bytes.toByteArray();
        }
    }

    /** DOCX из абзацев — собирает Apache POI, а не разбираемый нами код. */
    private static byte[] docx(List<String> paragraphs) throws IOException {
        try (var document = new XWPFDocument(); var bytes = new ByteArrayOutputStream()) {
            for (var text : paragraphs) {
                document.createParagraph().createRun().setText(text);
            }
            document.write(bytes);
            return bytes.toByteArray();
        }
    }

    /** DOCX с таблицей из одной строки в две ячейки. */
    private static byte[] docxWithTable(String left, String right) throws IOException {
        try (var document = new XWPFDocument(); var bytes = new ByteArrayOutputStream()) {
            var table = document.createTable(1, 2);
            table.getRow(0).getCell(0).setText(left);
            table.getRow(0).getCell(1).setText(right);
            document.write(bytes);
            return bytes.toByteArray();
        }
    }
}
