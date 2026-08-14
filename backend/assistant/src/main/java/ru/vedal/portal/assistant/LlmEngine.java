package ru.vedal.portal.assistant;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Optional;

// Порт наружу. Ранняя реализация — детерминированный поиск по опубликованному,
// полная — YandexGPT + pgvector.
//
// Модель получает только то, что мы ей отдали. Уговорить её показать закрытый
// файл нельзя, потому что файла в контексте нет: движок работает поверх
// интерфейсов модулей, которые отдают исключительно опубликованное.
public interface LlmEngine {

    @Schema(name = "Source", description = "Опубликованный материал, на который опирается ответ.")
    record Source(

            @Schema(description = "Название материала. У изделия — название и тип через тире.",
                    example = "VEDAL A-2000 — Инкубатор-трансформер")
            String title,

            @Schema(description = "Адрес материала на сайте.", example = "/products/vedal-a-2000/")
            String url,

            @Schema(description = "Откуда материал взят.",
                    allowableValues = {"product", "news", "document"}, example = "product")
            String kind) {}

    record Grounded(String text, List<Source> sources) {}

    // Пустой Optional означает «по опубликованному ничего не нашлось».
    // Придумывать ответ в этом случае запрещено — идёт передача человеку.
    Optional<Grounded> answer(String question);
}
