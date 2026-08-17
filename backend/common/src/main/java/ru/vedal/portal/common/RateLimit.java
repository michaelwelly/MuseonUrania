package ru.vedal.portal.common;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Лимит частоты по адресу клиента. Не бин: каждая публичная дверь создаёт свой
// экземпляр со своим бюджетом — вопросы ассистенту не должны съедать право
// отправить заявку.
//
// Счётчики в памяти процесса: при нескольких экземплярах приложения лимит
// станет per-instance и его придётся вынести в общее хранилище. Пока экземпляр
// один, этого достаточно.
//
// Адрес берётся из request.getRemoteAddr(), поэтому корректность зависит от
// server.forward-headers-strategy: без него все посетители за прокси считаются
// одним клиентом и лимит блокирует всех разом.
public final class RateLimit {

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();
    private final int limit;
    private final Duration window;

    public RateLimit(int limit, Duration window) {
        this.limit = limit;
        this.window = window;
    }

    public boolean allow(String client) {
        var now = Instant.now();
        var cutoff = now.minus(window);
        var deque = hits.computeIfAbsent(client, k -> new ArrayDeque<>());

        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                deque.pollFirst();
            }
            if (deque.size() >= limit) return false;
            deque.addLast(now);
            return true;
        }
    }

    // Без очистки карта растёт по одному ключу на каждый уникальный адрес
    // и не освобождается никогда.
    public void forget() {
        var cutoff = Instant.now().minus(window);
        hits.forEach((client, deque) -> {
            synchronized (deque) {
                while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                    deque.pollFirst();
                }
            }
        });
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty();
            }
        });
    }
}
