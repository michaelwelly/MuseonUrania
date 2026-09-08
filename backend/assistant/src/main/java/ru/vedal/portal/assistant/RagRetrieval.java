package ru.vedal.portal.assistant;

import java.util.List;

/**
 * Сначала индекс, потом слова.
 *
 * <p><b>Зачем нужен переход, а не замена.</b> Векторный поиск включается
 * раньше, чем у VEDAL появляется корпус документов (GitHub issue #38).
 * Если бы он заменял поиск по словам, включение означало бы, что ассистент
 * перестал отвечать: индекс пуст, находить нечего, каждый разговор уходит
 * человеку. Здесь пустой индекс означает ровно то, что означает, — «в индексе
 * не нашлось», — и слово переходит к прежнему поиску.
 *
 * <p>То же самое произойдёт и с непустым индексом на вопрос не по корпусу:
 * в датащитах нет ответа на «где вы находитесь», а в карточках и новостях
 * он есть.
 *
 * <p><b>Почему не смешиваем выдачи.</b> Расстояние в векторном поиске
 * и вес совпадения по словам — числа из разных шкал, и общего порядка
 * у них нет. Сложить их можно только придумав коэффициент, а придуманный
 * коэффициент — это ранжирование, которое никто не проверял. Когда появится
 * корпус и на нём можно будет мерить, гибридная выдача станет осмысленной
 * работой; сейчас она была бы догадкой.
 */
public class RagRetrieval implements Retrieval {

    private final Retrieval vectors;
    private final Retrieval words;

    public RagRetrieval(Retrieval vectors, Retrieval words) {
        this.vectors = vectors;
        this.words = words;
    }

    @Override
    public List<Passage> find(String question, LlmEngine.Scope scope) {
        var found = vectors.find(question, scope);
        return found.isEmpty() ? words.find(question, scope) : found;
    }
}
