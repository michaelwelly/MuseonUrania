package ru.vedal.portal.catalog;

import java.util.List;

// Единственное, что модуль показывает соседям. Всё остальное — внутреннее.
public interface CatalogQuery {

    List<PublicDto.CategoryView> categories();

    List<PublicDto.Card> publishedProducts();

    PublicDto.Detail publishedProduct(String slug);
}
