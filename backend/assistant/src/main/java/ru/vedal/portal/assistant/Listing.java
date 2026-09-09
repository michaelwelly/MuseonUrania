package ru.vedal.portal.assistant;

import java.util.List;

/**
 * Ответ без модели: перечень найденного со ссылками.
 *
 * <p>Он нужен в двух местах, и это единственная причина, по которой он живёт
 * отдельным классом. Первое — режим {@code engine=search}: там перечень и есть
 * ответ. Второе — молчание модели: материалы нашлись, и отдать их перечнем
 * лучше, чем звать человека из-за чужой недоступности.
 *
 * <p>Раньше второе место повторяло поиск заново, чтобы получить тот же текст.
 * Это стоило второго прохода по каталогу и, что хуже, давало ответ,
 * не обязанный совпадать с уже найденным: между двумя поисками редактор
 * успевает снять карточку с публикации, и посетитель получал бы сноски
 * на одно, а ссылки на другое.
 *
 * <p>Текст только перечисляет найденное и ведёт по ссылкам. Никаких выводов
 * о пригодности изделия и никаких характеристик по памяти.
 */
final class Listing {

    private Listing() {}

    static LlmEngine.Grounded of(List<Retrieval.Passage> found) {
        var sources = found.stream().map(Retrieval.Passage::source).toList();
        return new LlmEngine.Grounded(text(found, sources), sources);
    }

    private static String text(List<Retrieval.Passage> found, List<LlmEngine.Source> sources) {
        var body = new StringBuilder(head(found, sources));
        for (var s : sources) {
            body.append("\n— ").append(s.title());
        }
        body.append("\n\nПодробности — на страницах по ссылкам. "
                + "Подбор комплектации и коммерческие условия уточняет специалист.");
        return body.toString();
    }

    /**
     * Первая строка ответа.
     *
     * <p><b>Страница сайта отвечает своими словами.</b> На «про что этот сайт»
     * и «какие продукты у вас есть» перечень заголовков — не ответ: человек
     * спросил, чем занимается компания, и получил список ссылок, по которым
     * ему предлагается это выяснить самому. У страницы главное сказано
     * первым абзацем, и он уже опубликован — сказать его вслух не выдумка,
     * а цитирование самих себя.
     *
     * <p>Берётся ровно то, что стоит до {@link SitePages#BREAK}: остальной
     * текст страницы длиннее ответа в чате и предназначен модели, а не
     * посетителю.
     */
    private static String head(List<Retrieval.Passage> found, List<LlmEngine.Source> sources) {
        var first = found.get(0);
        if ("page".equals(first.source().kind())) {
            var text = first.text();
            var border = text.indexOf(SitePages.BREAK);
            var lead = border < 0 ? text : text.substring(0, border);
            return lead.strip() + "\n\nГде посмотреть:";
        }

        var products = sources.stream().filter(s -> s.kind().equals("product")).count();
        return products > 0
                ? "Вот что подходит по вашему запросу из каталога VEDAL:"
                : "Вот что нашлось по вашему запросу:";
    }
}
