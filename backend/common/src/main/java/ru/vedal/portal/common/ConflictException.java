package ru.vedal.portal.common;

// Действие спорит с уже существующим состоянием: занятый slug, попытка
// удалить категорию с изделиями. Отдельный тип, потому что 409 и 400 —
// разные вещи для интерфейса: первое чинится другим значением, второе —
// исправлением формы.
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
