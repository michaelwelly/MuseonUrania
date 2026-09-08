package ru.vedal.portal.assistant;

import java.util.List;

/**
 * Подставная модель эмбеддингов для тестов индекса.
 *
 * <p><b>Почему не настоящая.</b> За настоящей — сеть, деньги и чужая
 * доступность, то есть всё, чего в тесте быть не должно. Проверяется здесь
 * не качество векторов, а устройство вокруг них: что попадает в индекс,
 * что находится, что не находится и сколько раз спрашивают модель.
 *
 * <p><b>Как устроен вектор.</b> Каждой синтетической метке отведена своя
 * координата, в неё кладётся число вхождений слова. Тогда расстояния
 * предсказуемы: текст про кубик и вопрос про кубик смотрят в одну сторону
 * (расстояние 0), текст про кубик и вопрос про шар — под прямым углом
 * (расстояние 1). Именно на этом и держатся проверки порога.
 *
 * <p>Метки нарочно не похожи на данные VEDAL: кубики, шары и пирамиды
 * с полигона. Придумывать характеристики изделий, сертификаты и статусы
 * регистрации ради теста запрещено правилами проекта, а нарезке и поиску
 * по близости всё равно, что именно они обрабатывают.
 */
class SyntheticEmbeddings implements Embeddings {

    static final List<String> MARKERS = List.of("кубик", "шар", "пирамида", "спираль");

    private final String name;

    int documentCalls;
    int queryCalls;

    SyntheticEmbeddings() {
        this("emb://polygon/synthetic-doc/latest");
    }

    SyntheticEmbeddings(String name) {
        this.name = name;
    }

    @Override
    public int dimension() {
        return YandexEmbeddings.DIMENSION;
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public float[] ofDocument(String text) {
        documentCalls++;
        return vector(text);
    }

    @Override
    public float[] ofQuery(String text) {
        queryCalls++;
        return vector(text);
    }

    private float[] vector(String text) {
        var vector = new float[dimension()];
        var lower = text.toLowerCase();
        var empty = true;

        for (var at = 0; at < MARKERS.size(); at++) {
            var count = occurrences(lower, MARKERS.get(at));
            vector[at] = count;
            if (count > 0) empty = false;
        }

        // Нулевой вектор запрещён: косинусное расстояние до него не определено,
        // и pgvector вернул бы NaN. Текст без единой метки получает свою
        // отдельную координату — он «далеко» от всех остальных.
        if (empty) vector[vector.length - 1] = 1;
        return vector;
    }

    private static int occurrences(String text, String word) {
        var count = 0;
        var at = text.indexOf(word);
        while (at >= 0) {
            count++;
            at = text.indexOf(word, at + word.length());
        }
        return count;
    }
}
