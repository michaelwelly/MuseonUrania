package ru.vedal.portal.assistant;

import java.util.ArrayList;
import java.util.List;

/**
 * Нарезка материала на фрагменты.
 *
 * <p><b>Зачем резать.</b> Вектор целого буклета — это вектор «вообще про
 * VEDAL»: он одинаково недалёк от любого вопроса и потому не отвечает
 * ни на один. Фрагмент говорит об одном сюжете, и близость к нему что-то
 * значит. Плюс арифметика контекста: в промпт модели помещается несколько
 * выдержек, а не несколько документов.
 *
 * <p><b>Почему по абзацам, а не по числу знаков подряд.</b> Резать вслепую
 * значит рвать предложение пополам, и обе половины перестают отвечать
 * на что-либо: «Инкубатор предназначен для» и «выхаживания новорождённых»
 * по отдельности бессмысленны. Здесь граница ищется по абзацу, а если
 * абзац длиннее предела — по концу предложения; посреди слова разрез
 * не ставится никогда.
 *
 * <p><b>Зачем перекрытие.</b> Ответ на вопрос часто лежит на стыке: в одном
 * абзаце назван предмет, в следующем сказано о нём главное. Без перекрытия
 * ни один фрагмент не содержит обоих, и найденное отвечает наполовину.
 * Хвост предыдущего фрагмента повторяется в начале следующего — это плата
 * местом за то, чтобы стык не терялся.
 *
 * <p><b>Меряем знаками, а не токенами.</b> Токенизатор — это про конкретную
 * модель: у неё своя, и меняется она вместе с моделью. Знаки считаются
 * одинаково всегда, а перевод грубый и известный: у русского текста
 * примерно три-четыре знака на токен, то есть предел в 1400 знаков — это
 * те самые «500-1000 токенов» из спеки конвейера, с запасом на английский.
 */
final class Chunks {

    /** Предел фрагмента в знаках. */
    static final int MAX = 1400;

    /**
     * Сколько знаков хвоста повторяется в начале следующего фрагмента.
     *
     * <p>Примерно абзац. Больше — и половина индекса станет копиями:
     * перекрытие оплачивается и местом, и деньгами за эмбеддинги.
     */
    static final int OVERLAP = 200;

    /**
     * Огрызок, который не стоит отдельного вектора.
     *
     * <p>Фрагмент короче этого — это подпись, заголовок таблицы или остаток
     * последнего абзаца. Своего сюжета в нём нет, а вектор у него есть,
     * и в выдаче он оказывается наравне с содержательными.
     */
    static final int MIN = 80;

    private Chunks() {}

    /**
     * Разрезать текст.
     *
     * <p>Пустой текст даёт пустой список — материал без текста не индексируется
     * вовсе. Короткий текст даёт один фрагмент: резать нечего, а выбрасывать
     * его как «короткий» нельзя, это и есть весь материал.
     */
    static List<String> of(String text) {
        if (text == null || text.isBlank()) return List.of();

        var normalized = text.strip().replaceAll("[ \\t\\x0B\\f\\r]+", " ");
        if (normalized.length() <= MAX) return List.of(normalized);

        var chunks = new ArrayList<String>();
        var current = new StringBuilder();

        for (var piece : pieces(normalized)) {
            if (!current.isEmpty() && current.length() + piece.length() + 1 > MAX) {
                chunks.add(current.toString().strip());
                current = new StringBuilder(tail(current.toString()));
            }
            if (!current.isEmpty()) current.append("\n");
            current.append(piece);
        }

        var last = current.toString().strip();
        if (!last.isEmpty()) {
            // Последний огрызок не заводит своего фрагмента: он приклеивается
            // к предыдущему. Отдельный вектор для двух строк подписи всё
            // равно ничему не соответствует, а место в выдаче занимает.
            if (last.length() < MIN && !chunks.isEmpty()) {
                var previous = chunks.removeLast();
                chunks.add(previous + "\n" + last);
            } else {
                chunks.add(last);
            }
        }
        return List.copyOf(chunks);
    }

    /**
     * Куски, из которых собираются фрагменты: абзацы, а слишком длинный
     * абзац — предложения. Предложение длиннее предела режется по знакам:
     * такое встречается в таблицах и перечнях, вытащенных из PDF одной
     * строкой, и оставить его целым значит не порезать материал вовсе.
     */
    private static List<String> pieces(String text) {
        var pieces = new ArrayList<String>();
        for (var paragraph : text.split("\\n\\s*\\n|\\n")) {
            var trimmed = paragraph.strip();
            if (trimmed.isEmpty()) continue;
            if (trimmed.length() <= MAX) {
                pieces.add(trimmed);
                continue;
            }
            for (var sentence : trimmed.split("(?<=[.!?…])\\s+")) {
                var one = sentence.strip();
                if (one.isEmpty()) continue;
                while (one.length() > MAX) {
                    pieces.add(one.substring(0, MAX));
                    one = one.substring(MAX);
                }
                if (!one.isEmpty()) pieces.add(one);
            }
        }
        return pieces;
    }

    /**
     * Хвост фрагмента, который повторится в следующем.
     *
     * <p>Отрезается по границе слова: перекрытие, начинающееся с середины
     * слова, добавляет в индекс обломок, которого в тексте нет.
     */
    private static String tail(String chunk) {
        if (chunk.length() <= OVERLAP) return chunk;

        var from = chunk.length() - OVERLAP;
        var space = chunk.indexOf(' ', from);
        return space < 0 ? "" : chunk.substring(space + 1);
    }
}
