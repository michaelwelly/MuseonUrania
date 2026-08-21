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
import java.util.Set;

// Ранняя реализация порта: поиск по словам, без модели. Ходит только через
// интерфейсы модулей, а они отдают ровно то, что положено области: посетителю —
// опубликованное и публичное, сотруднику — плюс документы уровня internal.
// Неопубликованное изделие, черновик новости и confidential-документ сюда
// физически не попадут ни в одной из областей.
@Component
public class DeterministicSearch implements LlmEngine {

    private static final int MAX_SOURCES = 4;

    // Четыре символа, а не три: на трёх «про» из «расскажи про погоду» находится
    // внутри «запросу», и ассистент отвечает каталогом на вопрос не по теме.
    private static final int MIN_TOKEN = 4;

    // Марка стоит в названии каждого изделия и в подписи каждого документа,
    // поэтому совпадением она не является: по слову «vedal» находится вообще
    // всё. Замерено на живом стенде — вопрос «What is VEDAL A-2000? price?»
    // приводил в ответ ещё и VEDAL R1, попавший туда единственным словом,
    // которое есть у всех.
    //
    // Строка «ведал» здесь тоже намеренно: посетитель пишет марку и кириллицей.
    // Совпадение с формой глагола «ведал» роли не играет — слово выбрасывается
    // только из подсчёта, а не из вопроса.
    private static final Set<String> BRAND = Set.of("vedal", "ведал", "вэдал");

    // Совпадение в названии весит больше, чем в описании. Без веса «инкубатор»
    // в названии изделия и «инкубатор», случайно попавший в текст новости,
    // стоят одинаково, и новость обгоняет изделие, если слов в ней больше.
    private static final int NAME = 3;
    private static final int TEXT = 1;

    // Порог: одного случайного слова в описании мало, чтобы назвать материал
    // подходящим. Совпадение по названию (вес 3) порог проходит сразу,
    // одинокое слово из описания (вес 1) — нет.
    //
    // Не пройти порог — штатный исход, а не пустой ответ: разговор уходит
    // к человеку. Это лучше, чем список изделий, подобранный по слову «для».
    private static final int MIN_SCORE = 2;

    private final CatalogQuery catalog;
    private final ContentQuery content;
    private final DocumentQuery documents;

    public DeterministicSearch(CatalogQuery catalog, ContentQuery content, DocumentQuery documents) {
        this.catalog = catalog;
        this.content = content;
        this.documents = documents;
    }

    @Override
    public Optional<Grounded> answer(String question, Scope scope) {
        var tokens = tokens(question);
        if (tokens.isEmpty()) return Optional.empty();

        record Hit(Source source, int score) {}
        var hits = new ArrayList<Hit>();

        for (var p : catalog.publishedProducts()) {
            var score = score(tokens,
                    named(p.name(), p.kind()),
                    text(p.summary(), String.join(" ", p.categories())));
            if (score >= MIN_SCORE) {
                hits.add(new Hit(new Source(p.name() + " — " + p.kind(),
                        "/products/" + p.slug() + "/", "product"), score));
            }
        }

        for (var n : content.publishedNews()) {
            var score = score(tokens, named(n.title()), text(n.excerpt(), n.tag()));
            if (score >= MIN_SCORE) {
                hits.add(new Hit(new Source(n.title(), "/news/", "news"), score));
            }
        }

        // Единственное место, где области расходятся. Изделия и новости
        // в обоих контурах одни и те же — опубликованные: черновик карточки
        // сотруднику показывать незачем, он смотрит его в админке.
        var visible = scope == Scope.STAFF ? documents.staffDocuments() : documents.listedDocuments();
        for (var d : visible) {
            var score = score(tokens, named(d.title(), d.subject()), text(d.group()));
            if (score >= MIN_SCORE) {
                hits.add(new Hit(new Source(label(d), d.published() ? d.fileUrl() : "/documents/",
                        "document"), score));
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

    /**
     * Подпись документа в ответе ассистента.
     *
     * Документ со статусом {@code pending} — это документ, наличие которого
     * никто не подтвердил. В перечне на сайте рядом с таким стоит подпись
     * «Уточняется», и без неё строка «Сертификат ISO 13485 — Производство»
     * читается как утверждение, что сертификат есть.
     *
     * Именно это утверждение §6.4 плана убрала со страницы «Производство»
     * вместе с блоком «Качество». Ассистент повторял его дословно, только
     * без статуса — и правило «не выдумывать сертификаты» обходилось не
     * выдумкой, а умолчанием.
     *
     * Скрывать такие документы целиком нельзя: на вопрос «есть ли ISO»
     * пустой ответ читается как «нет», а это тоже утверждение, которого мы
     * не знаем. Показываем с тем же статусом, что и страница.
     */
    private static String label(DocumentQuery.Card d) {
        var title = d.title() + " — " + d.subject();
        return "pending".equals(d.access()) ? title + " (статус уточняется)" : title;
    }

    private static List<String> tokens(String question) {
        return words(question).stream()
                .filter(t -> t.length() >= MIN_TOKEN)
                .filter(t -> !BRAND.contains(t))
                .distinct()
                .toList();
    }

    /** Поле, совпадение в котором весит как название. */
    private static Weighted named(String... fields) {
        return new Weighted(NAME, words(String.join(" ", fields)));
    }

    /** Поле, совпадение в котором весит как описание. */
    private static Weighted text(String... fields) {
        return new Weighted(TEXT, words(String.join(" ", fields)));
    }

    private record Weighted(int weight, List<String> words) {}

    /**
     * Насколько материал подходит вопросу.
     *
     * <p>За каждое слово вопроса берётся ЛУЧШИЙ вес, а не сумма по полям:
     * «инкубатор», стоящий и в названии, и в описании, — это одно совпадение,
     * а не два. Суммируя, мы дали бы преимущество карточкам с длинным текстом,
     * то есть тем, кто больше про себя написал, а не тем, кто ближе к вопросу.
     *
     * <p>Совпадение по началу слова, а не по подстроке: подстрока находит «про»
     * внутри «запросу» и склеивает несвязанные вещи. Начало слова терпимо
     * к русской морфологии — «инкубатор» найдёт и «инкубаторы».
     */
    private static int score(List<String> tokens, Weighted... fields) {
        var score = 0;
        for (var token : tokens) {
            var best = 0;
            for (var field : fields) {
                // Обратное направление тоже нужно («инкубаторы» в вопросе против
                // «инкубатор» в каталоге), но короткие служебные слова вроде «для»
                // и «при» в нём участвовать не должны — под них подойдёт слишком много.
                var hit = field.words().stream().anyMatch(w ->
                        w.startsWith(token) || (w.length() >= MIN_TOKEN && token.startsWith(w)));
                if (hit) best = Math.max(best, field.weight());
            }
            score += best;
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
