package ru.vedal.portal.assistant;

import java.util.List;
import java.util.Optional;

// Порт наружу. Ранняя реализация — детерминированный поиск по опубликованному,
// полная — YandexGPT + pgvector.
//
// Модель получает только то, что мы ей отдали. Уговорить её показать закрытый
// файл нельзя, потому что файла в контексте нет: движок работает поверх
// интерфейсов модулей, которые отдают исключительно опубликованное.
public interface LlmEngine {

    record Source(String title, String url, String kind) {}

    record Grounded(String text, List<Source> sources) {}

    // Пустой Optional означает «по опубликованному ничего не нашлось».
    // Придумывать ответ в этом случае запрещено — идёт передача человеку.
    Optional<Grounded> answer(String question);
}
