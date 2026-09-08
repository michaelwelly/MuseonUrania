package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Нарезка материала на фрагменты.
 *
 * <p>Тексты здесь заведомо синтетические — про кубики и шары. Это не лень:
 * настоящие датащиты VEDAL заказчик ещё не передал, а сочинять их
 * характеристики ради теста запрещено правилами проекта. Нарезке всё равно,
 * что резать, и проверяется именно она.
 */
class ChunksTest {

    @Test
    void emptyTextGivesNoChunks() {
        assertThat(Chunks.of(null)).isEmpty();
        assertThat(Chunks.of("")).isEmpty();
        assertThat(Chunks.of("   \n\n  ")).isEmpty();
    }

    // Короткий материал — это весь материал. Выбросить его как «слишком
    // короткий для фрагмента» значит не проиндексировать его вовсе.
    @Test
    void shortTextStaysOneChunk() {
        var text = "Синтетический материал полигона: красный кубик.";

        assertThat(Chunks.of(text)).containsExactly(text);
    }

    @Test
    void longTextIsCutIntoChunksWithinTheLimit() {
        var chunks = Chunks.of(paragraphs(40));

        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allSatisfy(chunk ->
                assertThat(chunk.length()).isLessThanOrEqualTo(Chunks.MAX + Chunks.MIN));
    }

    // Ответ часто лежит на стыке: в одном абзаце назван предмет, в следующем
    // сказано о нём главное. Без перекрытия ни один фрагмент не содержит
    // обоих, и найденное отвечает наполовину.
    @Test
    void neighbouringChunksOverlap() {
        var chunks = Chunks.of(paragraphs(40));

        for (var at = 1; at < chunks.size(); at++) {
            var start = chunks.get(at).substring(0, Math.min(40, chunks.get(at).length()));
            assertThat(chunks.get(at - 1))
                    .as("начало фрагмента %d должно повторять хвост предыдущего", at)
                    .contains(start);
        }
    }

    // Перекрытие начинается с целого слова. Обломок «...ора красный» —
    // это строка, которой в материале нет, и искать её незачем.
    @Test
    void overlapStartsAtAWordBoundary() {
        var chunks = Chunks.of(paragraphs(40));

        assertThat(chunks).allSatisfy(chunk ->
                assertThat(chunk).doesNotStartWith(" "));
    }

    // Нарезка ничего не теряет: слово, попавшее в материал, обязано попасть
    // хоть в один фрагмент. Потерянный абзац — это ответ, которого ассистент
    // не найдёт, и заметить это можно только по отсутствию ответа.
    @Test
    void nothingIsLost() {
        var chunks = Chunks.of(paragraphs(40));
        var glued = String.join(" ", chunks);

        for (var at = 0; at < 40; at++) {
            assertThat(glued).contains("меткой" + at);
        }
    }

    // Абзац длиннее предела режется по предложениям, а не пополам:
    // «Кубик предназначен для» и «проверки нарезки» по отдельности
    // не отвечают ни на что.
    @Test
    void anOverlongParagraphIsCutBySentences() {
        var sentence = "Синтетическое предложение про кубик номер %d на полигоне. ";
        var paragraph = new StringBuilder();
        for (var at = 0; at < 40; at++) {
            paragraph.append(sentence.formatted(at));
        }

        var chunks = Chunks.of(paragraph.toString());

        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allSatisfy(chunk ->
                assertThat(chunk.strip()).endsWith("."));
    }

    /** Синтетический материал: пронумерованные абзацы про фигуры на полигоне. */
    private static String paragraphs(int count) {
        var text = new StringBuilder();
        for (var at = 0; at < count; at++) {
            text.append("Абзац с меткой").append(at)
                    .append(" описывает синтетическую фигуру полигона: ")
                    .append(at % 2 == 0 ? "красный кубик" : "зелёный шар")
                    .append(", предназначенную исключительно для проверки нарезки текста.\n\n");
        }
        return text.toString();
    }
}
