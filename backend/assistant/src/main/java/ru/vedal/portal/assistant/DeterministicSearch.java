package ru.vedal.portal.assistant;

import org.springframework.stereotype.Component;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

// Ранняя реализация порта: поиск по словам, без модели. Ходит только через
// интерфейсы модулей, а они отдают исключительно опубликованное — неопубликованное
// изделие, черновик новости и несогласованный документ сюда физически не попадут.
@Component
public class DeterministicSearch implements LlmEngine {

    private static final int MAX_SOURCES = 4;

    // Четыре символа, а не три: на трёх «про» из «расскажи про погоду» находится
    // внутри «запросу», и ассистент отвечает каталогом на вопрос не по теме.
    private static final int MIN_TOKEN = 4;

    private final CatalogQuery catalog;
    private final ContentQuery content;
    private final DocumentQuery documents;

    public DeterministicSearch(CatalogQuery catalog, ContentQuery content, DocumentQuery documents) {
        this.catalog = catalog;
        this.content = content;
        this.documents = documents;
    }

    @Override
    public Optional<Grounded> answer(String question) {
        var tokens = tokens(question);
        if (tokens.isEmpty()) return Optional.empty();

        record Hit(Source source, int score) {}
        var hits = new ArrayList<Hit>();

        for (var p : catalog.publishedProducts()) {
            var score = score(tokens, p.name(), p.kind(), p.summary(), String.join(" ", p.categories()));
            if (score > 0) {
                hits.add(new Hit(new Source(p.name() + " — " + p.kind(),
                        "/products/" + p.slug() + "/", "product"), score));
            }
        }

        for (var n : content.publishedNews()) {
            var score = score(tokens, n.title(), n.excerpt(), n.tag());
            if (score > 0) {
                hits.add(new Hit(new Source(n.title(), "/news/", "news"), score));
            }
        }

        for (var d : documents.listedDocuments()) {
            var score = score(tokens, d.title(), d.subject(), d.group());
            if (score > 0) {
                hits.add(new Hit(new Source(d.title() + " — " + d.subject(),
                        d.published() ? d.fileUrl() : "/documents/", "document"), score));
            }
        }

        if (hits.isEmpty()) return Optional.empty();

        var sources = hits.stream()
                .sorted(Comparator.comparingInt(Hit::score).reversed())
                .limit(MAX_SOURCES)
                .map(Hit::source)
                .toList();

        return Optional.of(new Grounded(compose(sources), sources));
    }

    // Текст только перечисляет найденное и ведёт по ссылкам. Никаких выводов
    // о пригодности изделия и никаких характеристик по памяти.
    private static String compose(List<Source> sources) {
        var products = sources.stream().filter(s -> s.kind().equals("product")).count();
        var head = products > 0
                ? "Вот что подходит по вашему запросу из каталога VEDAL:"
                : "Вот что нашлось по вашему запросу:";

        var body = new StringBuilder(head);
        for (var s : sources) {
            body.append("\n— ").append(s.title());
        }
        body.append("\n\nПодробности — на страницах по ссылкам. "
                + "Подбор комплектации и коммерческие условия уточняет специалист.");
        return body.toString();
    }

    private static List<String> tokens(String question) {
        return words(question).stream()
                .filter(t -> t.length() >= MIN_TOKEN)
                .distinct()
                .toList();
    }

    // Совпадение по началу слова, а не по подстроке: подстрока находит «про»
    // внутри «запросу» и склеивает несвязанные вещи. Начало слова терпимо
    // к русской морфологии — «инкубатор» найдёт и «инкубаторы».
    private static int score(List<String> tokens, String... fields) {
        var haystack = words(String.join(" ", fields));
        var score = 0;
        for (var token : tokens) {
            // Обратное направление тоже нужно («инкубаторы» в вопросе против
            // «инкубатор» в каталоге), но короткие служебные слова вроде «для»
            // и «при» в нём участвовать не должны — под них подойдёт слишком много.
            if (haystack.stream().anyMatch(w ->
                    w.startsWith(token) || (w.length() >= MIN_TOKEN && token.startsWith(w)))) score++;
        }
        return score;
    }

    // «ё» приводим к «е»: посетитель печатает «новорожденных», в каталоге
    // «новорождённых», и без этого совпадения не будет.
    private static List<String> words(String text) {
        return Arrays.stream(text.toLowerCase().replace('ё', 'е').split("[^\\p{L}\\p{N}]+"))
                .filter(w -> !w.isBlank())
                .toList();
    }
}
