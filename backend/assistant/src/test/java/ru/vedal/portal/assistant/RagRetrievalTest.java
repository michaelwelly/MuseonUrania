package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Что происходит, когда индекс пуст.
 *
 * <p>Это главный вопрос всей задачи: векторный поиск включается раньше, чем
 * у VEDAL появляется корпус документов, и пустой индекс обязан быть рабочим
 * состоянием, а не отказом. Ассистент отвечает тем же, чем отвечал до
 * pgvector, — поиском по словам.
 */
class RagRetrievalTest {

    /** Поиск, отвечающий заготовкой и помнящий, спрашивали ли его. */
    private static final class Подставной implements Retrieval {
        final List<String> asked = new ArrayList<>();
        List<Passage> found = List.of();

        Подставной(Passage... passages) {
            this.found = List.of(passages);
        }

        @Override
        public List<Passage> find(String question, LlmEngine.Scope scope) {
            asked.add(question);
            return found;
        }
    }

    private static Retrieval.Passage passage(String title) {
        return new Retrieval.Passage(
                new LlmEngine.Source(title, "/synthetic/", "page"), "Синтетический фрагмент.");
    }

    @Test
    void anEmptyIndexHandsTheQuestionToTheWordSearch() {
        var vectors = new Подставной();
        var words = new Подставной(passage("Найдено словами"));

        var found = new RagRetrieval(vectors, words)
                .find("что это за фигура", LlmEngine.Scope.PUBLIC);

        assertThat(found).extracting(p -> p.source().title()).containsExactly("Найдено словами");
        assertThat(words.asked).containsExactly("что это за фигура");
    }

    // Найденное в индексе не смешивается с найденным по словам: расстояние
    // и вес совпадения — числа из разных шкал, и общего порядка у них нет.
    @Test
    void whenTheIndexAnswersTheWordSearchIsNotConsulted() {
        var vectors = new Подставной(passage("Найдено в индексе"));
        var words = new Подставной(passage("Найдено словами"));

        var found = new RagRetrieval(vectors, words)
                .find("что это за фигура", LlmEngine.Scope.PUBLIC);

        assertThat(found).extracting(p -> p.source().title()).containsExactly("Найдено в индексе");
        assertThat(words.asked).isEmpty();
    }

    // Ни один из двух ничего не нашёл — это штатный исход, а не ошибка:
    // правило проекта «нет опубликованных материалов — нет ответа», разговор
    // уходит человеку.
    @Test
    void nothingFoundAnywhereStaysNothing() {
        var found = new RagRetrieval(new Подставной(), new Подставной())
                .find("какая сегодня погода", LlmEngine.Scope.PUBLIC);

        assertThat(found).isEmpty();
    }
}
