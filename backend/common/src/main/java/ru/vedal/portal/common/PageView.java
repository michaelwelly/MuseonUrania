package ru.vedal.portal.common;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

// Страница списка в ответе админки. Своя, а не Page из Spring Data: тот
// сериализуется вместе с внутренностями сортировки и пейджера, состав которых
// меняется от версии к версии — контракт админки не должен от этого зависеть.
@Schema(name = "Page", description = "Страница списка.")
public record PageView<T>(

        @Schema(description = "Строки страницы.")
        List<T> items,

        @Schema(description = "Номер страницы, с нуля.", example = "0")
        int page,

        @Schema(description = "Размер страницы.", example = "50")
        int size,

        @Schema(description = "Всего строк во всей выборке.", example = "137")
        long total,

        @Schema(description = "Всего страниц.", example = "3")
        int pages) {

    public static <E, T> PageView<T> of(Page<E> page, Function<E, T> map) {
        return new PageView<>(page.getContent().stream().map(map).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
