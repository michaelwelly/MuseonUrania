package ru.vedal.portal.assistant;

import ru.vedal.portal.documents.DocumentQuery;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Deterministic answers for requests whose result is a portal download. */
final class DocumentAnswers {

    private static final Set<String> ACTION = Set.of(
            "pdf", "файл", "файла", "скачать", "скачивания", "покажи", "показать",
            "дай", "дайте", "пришли", "пришлите");
    private static final Set<String> LIST = Set.of(
            "перечисли", "перечислите", "список", "доступные", "доступных", "какие");
    private static final Set<String> NOISE = Set.of(
            "vedal", "pdf", "файл", "файла", "скачать", "скачивания", "покажи",
            "показать", "дай", "дайте", "пришли", "пришлите", "документ", "документы",
            "документа", "доступен", "доступны", "где", "именно", "технический",
            "техническими", "характеристиками", "отдельным");

    private final DocumentQuery documents;

    DocumentAnswers(DocumentQuery documents) {
        this.documents = documents;
    }

    Optional<AskReply> answer(String question, LlmEngine.Scope scope) {
        var words = words(question);
        var visible = scope == LlmEngine.Scope.STAFF
                ? documents.staffDocuments()
                : documents.listedDocuments();

        if (words.stream().anyMatch(LIST::contains)
                && words.stream().anyMatch(word -> word.startsWith("документ"))) {
            var published = visible.stream().filter(DocumentQuery.Card::published).toList();
            if (published.isEmpty()) return Optional.empty();
            var names = published.stream().map(DocumentQuery.Card::title)
                    .collect(Collectors.joining("; "));
            return Optional.of(new AskReply(
                    "Сейчас опубликованы: " + names + ". Все файлы доступны по ссылкам ниже.",
                    published.stream().map(DocumentAnswers::source).toList(), null));
        }

        if (words.stream().noneMatch(ACTION::contains)) return Optional.empty();

        var match = visible.stream()
                .filter(DocumentQuery.Card::published)
                .map(card -> new Match(card, score(question, words, card)))
                .filter(matchAt -> matchAt.score() > 0)
                .max(Comparator.comparingInt(Match::score));
        if (match.isEmpty()) return Optional.empty();

        var card = match.get().card();
        return Optional.of(new AskReply(
                "Документ «" + card.title() + "» доступен для скачивания по ссылке ниже.",
                List.of(source(card)), null));
    }

    private static int score(String question, List<String> questionWords, DocumentQuery.Card card) {
        var haystack = words(String.join(" ", card.title(), card.subject(), card.slug()));
        var meaningful = questionWords.stream().filter(word -> !NOISE.contains(word)).toList();
        var score = (int) meaningful.stream().filter(haystack::contains).distinct().count();

        var normalizedQuestion = normalize(question);
        var subject = normalize(card.subject());
        if (!subject.isBlank() && normalizedQuestion.contains(subject)) score += 10;
        var model = modelToken(card);
        if (!model.isBlank() && normalizedQuestion.matches(".*\\bне\\s+(?:vedal\\s+)?"
                + java.util.regex.Pattern.quote(model) + "\\b.*")) {
            score -= 20;
        }
        return score;
    }

    private static String modelToken(DocumentQuery.Card card) {
        var slug = card.slug().toLowerCase(Locale.ROOT);
        if (slug.contains("a-2000")) return "a2000";
        if (slug.contains("t-100")) return "t100";
        if (slug.contains("r1")) return "r1";
        if (slug.contains("r2")) return "r2";
        return "";
    }

    private static LlmEngine.Source source(DocumentQuery.Card card) {
        return new LlmEngine.Source(card.title(), card.fileUrl(), "document");
    }

    private static List<String> words(String text) {
        return Arrays.stream(normalize(text).split("[^a-zа-яё0-9]+"))
                .filter(word -> !word.isBlank())
                .toList();
    }

    private static String normalize(String text) {
        return Optional.ofNullable(text).orElse("")
                .toLowerCase(Locale.ROOT)
                .replace('ё', 'е')
                .replaceAll("(?iu)vedal\\s*[тt]\\s*[- ]?\\s*100", "vedal t100")
                .replaceAll("(?iu)\\b[тt]\\s*[- ]?\\s*100\\b", "t100")
                .replaceAll("(?iu)\\b([ar])\\s*[- ]?\\s*(\\d+)\\b", "$1$2")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record Match(DocumentQuery.Card card, int score) {}
}
