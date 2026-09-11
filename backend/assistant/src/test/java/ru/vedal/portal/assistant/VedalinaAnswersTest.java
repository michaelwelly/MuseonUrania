package ru.vedal.portal.assistant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.catalog.CatalogQuery;
import ru.vedal.portal.catalog.PublicDto;
import ru.vedal.portal.content.ContentQuery;
import ru.vedal.portal.documents.DocumentQuery;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Вопросы, которые Ведалине задают на живом стенде.
 *
 * <p><b>Почему такой тест понадобился.</b> Владелец портала 9 сентября:
 * «наша Ведалина не хочет общаться и всё время на сотрудников переносит».
 * В списке разговоров — страница за страницей передач специалисту:
 * «привет», «hi», «про что этот сайт», «Какие продукты у вас есть?»,
 * «что такое Vedal-1000?». На всё это ассистент отвечал одинаково:
 * «по этому вопросу у меня нет согласованных материалов» — и ставил
 * разговор в очередь к человеку, которого в этот час не было на связи.
 *
 * <p>Отказ был формально честным: искать было негде. Материалов у ассистента
 * ровно три вида — карточки изделий, новости и строки перечня документов;
 * текстов страниц сайта в них не было вовсе.
 *
 * <p><b>Что этот тест стережёт.</b> Границу между двумя разными вещами.
 * Слева — вопросы, на которые сайт отвечает своими же опубликованными
 * страницами: про компанию, про каталог, про разделы. Отказываться от них —
 * не осторожность, а неработающий ассистент. Справа — цена, сроки, наличие
 * и статус регистрации: там отказ и есть правильный ответ, и он обязан
 * таким остаться.
 *
 * <p>Материалы здесь — те же четыре изделия и те же строки перечня, что
 * стоят на стенде: проверять поиск на выдуманном каталоге значит проверять
 * не то, что сломалось.
 */
class VedalinaAnswersTest {

    private static final String PHONE = "8 800 600 3449";
    private static final String EMAIL = "sales@vedal-med.ru";

    private final SitePages pages = new SitePages(PHONE, EMAIL, "09:00", "17:30");
    private final DeterministicSearch search =
            new DeterministicSearch(new Каталог(), new Лента(), new Перечень(), pages);
    private final AssistantService vedalina = new AssistantService(
            new Guardrails(), search, Mockito.mock(AuditLog.class), PHONE, EMAIL);

    private AskReply ask(String question) {
        return vedalina.ask(question, LlmEngine.Scope.PUBLIC, "public");
    }

    // ————— на это она обязана отвечать —————

    @Test
    void sheSaysWhatTheSiteIsAbout() {
        var reply = ask("про что этот сайт");

        assertThat(reply.handoff())
                .as("вопрос о сайте специалисту передавать незачем: сайт сам о себе написан")
                .isNull();
        assertThat(reply.answer())
                .contains("производит медицинское оборудование")
                .contains("неонатологии");
        assertThat(reply.sources()).extracting(LlmEngine.Source::kind).contains("page");
    }

    @Test
    void sheNamesWhatIsInTheCatalogue() {
        var reply = ask("Какие продукты у вас есть?");

        assertThat(reply.handoff()).isNull();
        assertThat(reply.answer())
                .as("состав каталога берётся из каталога, а не переписан строкой")
                .contains("VEDAL A-2000")
                .contains("VEDAL R1")
                .contains("VEDAL Т-100");
        assertThat(reply.sources()).extracting(LlmEngine.Source::url).contains("/products/");
    }

    @Test
    void sheTellsWhatAProductIs() {
        var reply = ask("что такое VEDAL A-2000");

        assertThat(reply.handoff()).isNull();
        assertThat(reply.answer()).contains("VEDAL A-2000");
        assertThat(reply.sources()).extracting(LlmEngine.Source::url)
                .contains("/products/vedal-a-2000/");
    }

    // Приветствие в поиск не идёт вовсе: искать по нему нечего, а до правки
    // «привет» уходило к человеку как вопрос без источников.
    @ParameterizedTest
    @ValueSource(strings = {"привет", "hi", "здравствуйте", "добрый день"})
    void aGreetingIsAnsweredWithAGreeting(String greeting) {
        var reply = ask(greeting);

        assertThat(reply.handoff())
                .as("за «привет» специалиста не зовут: %s", greeting)
                .isNull();
        assertThat(reply.answer()).contains("Ведалина");
    }

    // Ещё несколько вопросов из ленты стенда. Каждый из них раньше кончался
    // «нет согласованных материалов».
    @ParameterizedTest
    @ValueSource(strings = {
            "чем занимается компания",
            "где вы находитесь",
            "как с вами связаться",
            "где производство",
            "какие документы у вас есть",
            "как оставить сервисный запрос",
    })
    void questionsTheSiteItselfAnswersAreNotRefused(String question) {
        var reply = ask(question);

        assertThat(reply.answer())
                .as("вопрос со стенда: %s", question)
                .doesNotContain("придумывать ответ я не буду");
        assertThat(reply.sources())
                .as("ответ опирается на опубликованное: %s", question)
                .isNotEmpty();
    }

    // ————— а на это отвечать нельзя —————

    @Test
    void thePriceIsNotInvented() {
        var reply = ask("Сколько стоит инкубатор?");

        assertThat(reply.answer())
                .contains("Цены не публикуются")
                .as("отказ говорит, что можно сделать дальше")
                .contains("коммерческое предложение");
        assertThat(reply.sources()).isEmpty();
        assertThat(reply.handoff()).isNotNull();
        assertThat(reply.handoff().queue())
                .as("цену считает специалист — здесь очередь уместна")
                .isTrue();
        assertThat(reply.handoff().phone()).isEqualTo(PHONE);
    }

    @Test
    void deliveryDatesAreNotInvented() {
        var reply = ask("когда поставите");

        assertThat(reply.answer()).contains("Сроки и наличие подтверждает специалист");
        assertThat(reply.handoff()).isNotNull();
        assertThat(reply.handoff().queue()).isTrue();
    }

    // Самый тонкий случай. Строка перечня «Регистрационное удостоверение —
    // VEDAL A-2000» на этот вопрос читается как «да, есть» — хотя рядом с ней
    // стоит статус «наличие уточняется». Правило «не выдумывать статус
    // регистрации» обходится не выдумкой, а пересказом.
    @Test
    void theRegistrationStatusIsNotClaimed() {
        var reply = ask("есть ли регистрационное удостоверение");

        assertThat(reply.answer())
                .contains("Наличие и статус разрешительных документов я не подтверждаю")
                .as("и ни слова о том, что удостоверение есть")
                .doesNotContain("Статус: опубликован");
        assertThat(reply.handoff()).isNotNull();
        assertThat(reply.handoff().queue()).isTrue();
    }

    // ————— очередь заводится не на всё —————
    //
    // Очередь, куда падает каждый разговор, равна отсутствию очереди:
    // дежурный перестаёт её читать, и настоящее обращение тонет среди
    // случайных.
    @Test
    void aQuestionWithNoMaterialsDoesNotCallASpecialist() {
        var reply = ask("подскажите рецепт борща");

        assertThat(reply.answer())
                .as("не выдумывает")
                .contains("придумывать ответ я не буду")
                .as("и говорит, о чём спросить можно")
                .contains("каталог");
        assertThat(reply.handoff())
                .as("контакты показать стоит")
                .isNotNull();
        assertThat(reply.handoff().queue())
                .as("а специалисту продолжать здесь нечего")
                .isFalse();
    }

    @Test
    void askingForAPersonStillCallsAPerson() {
        var reply = ask("позовите специалиста");

        assertThat(reply.answer()).contains("Зову специалиста VEDAL");
        assertThat(reply.handoff()).isNotNull();
        assertThat(reply.handoff().queue()).isTrue();
    }

    // ————— материалы стенда —————

    /** Каталог первого релиза: те же четыре позиции, что на сайте. */
    private static final class Каталог implements CatalogQuery {

        @Override
        public List<PublicDto.CategoryView> categories() {
            return List.of(new PublicDto.CategoryView("неонатология", "Неонатология"));
        }

        @Override
        public List<PublicDto.Card> publishedProducts() {
            return List.of(
                    card("vedal-a-2000", "VEDAL A-2000", "Инкубатор-трансформер",
                            "Совмещает инкубатор закрытого типа и открытую реанимационную "
                                    + "систему. Переход между режимами электромеханическими "
                                    + "приводами, без перекладывания новорождённого.",
                            List.of("Неонатология", "Интенсивная терапия")),
                    card("vedal-r1", "VEDAL R1", "Открытая реанимационная система",
                            "Лучистый обогрев, встроенные весы, пульсоксиметрия.",
                            List.of("Реанимация")),
                    card("vedal-r2", "VEDAL R2", "Открытая реанимационная система",
                            "К обогреву и мониторингу добавляются ЖК-дисплей, фототерапия "
                                    + "и аспиратор.",
                            List.of("Реанимация")),
                    card("vedal-t-100", "VEDAL Т-100", "Система терморегулирующая",
                            "Терморегуляция 12–39 °C по датчикам пациента, два размера одеял.",
                            List.of("Интенсивная терапия")));
        }

        @Override
        public PublicDto.Detail publishedProduct(String slug) {
            throw new UnsupportedOperationException("поиску карточка целиком не нужна");
        }

        private static PublicDto.Card card(String slug, String name, String kind, String summary,
                                           List<String> categories) {
            return new PublicDto.Card(slug, name, kind, summary, "confirmed", categories,
                    null, null);
        }
    }

    private static final class Лента implements ContentQuery {

        @Override
        public List<Card> publishedNews() {
            return List.of(new Card("postavka-v-perinatalnyy-centr", "Производство",
                    "Поставка в перинатальный центр",
                    "Партия изделий отгружена в перинатальный центр.",
                    LocalDate.of(2026, 8, 13), null, null));
        }

        @Override
        public Article publishedArticle(String slug) {
            throw new UnsupportedOperationException("поиску текст новости целиком не нужен");
        }
    }

    /** Перечень документов: финальный открытый пакет сайта. */
    private static final class Перечень implements DocumentQuery {

        @Override
        public List<Card> listedDocuments() {
            return List.of(
                    new Card("vedal-a-2000-product-sheet",
                            "Инкубатор-трансформер VEDAL A-2000",
                            "Техническая документация", "VEDAL A-2000",
                            "vedal-a-2000", "pdf", true,
                            "/api/public/v1/documents/vedal-a-2000-product-sheet/file"),
                    new Card("vedal-product-catalog",
                            "Каталог продукции VEDAL", "Коммерческие материалы",
                            "Все изделия", null, "pdf", true,
                            "/api/public/v1/documents/vedal-product-catalog/file"));
        }

        @Override
        public List<Card> staffDocuments() {
            return listedDocuments();
        }

        @Override
        public Optional<Download> listedFile(String slug) {
            return Optional.empty();
        }

        @Override
        public Optional<Ref> ref(UUID id) {
            return Optional.empty();
        }

        @Override
        public List<Ref> refs(Collection<UUID> ids) {
            return List.of();
        }

        @Override
        public Download download(String slug) {
            throw new UnsupportedOperationException("поиск файлов не отдаёт");
        }
    }
}
