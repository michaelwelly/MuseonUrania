# Catalog Module Implementation Plan

**Русский** · [English](2026-08-06-catalog-module.en.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Каталог продукции переезжает из захардкоженного `frontend/content/products.ts` в базу: публичное API отдаёт опубликованные позиции, сотрудник правит их через админку.

**Architecture:** Одно приложение Spring Boot. Данные в PostgreSQL, схема только через Flyway. Публичное чтение и админка — разные входы одного приложения: `/api/public/v1/**` без авторизации и только опубликованное, `/admin/**` под сессией. Тесты идут на настоящем PostgreSQL через Testcontainers.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Maven wrapper, Spring Data JPA, Flyway, PostgreSQL 16, Thymeleaf, Spring Security, Testcontainers.

## Global Constraints

- Ветка `back`. Коммиты по Conventional Commits с префиксом слоя: `feat(back):`, `fix(back):`, `test(back):`, `chore(back):`.
- Коммиты только от имени пользователя. Никаких трейлеров `Co-Authored-By` и упоминаний ИИ ни в сообщениях, ни в файлах.
- Приложение слушает порт **8081**: 8080 занят чужим контейнером.
- PostgreSQL для разработки — контейнер на порту **5434**: 5432 занят нативной установкой, 5433 — чужим контейнером.
- Схема меняется **только миграциями Flyway**. `spring.jpa.hibernate.ddl-auto=validate`, никогда не `update`.
- Публичное API отдаёт только записи с `published = true`.
- `doc_status` (`confirmed` | `pending`) и `published` — **разные флаги**. Первый рисует бейдж «Документация подтверждена» на сайте, второй управляет видимостью. Схлопывать нельзя.
- Ошибки API — `application/problem+json`.
- Тесты доменов и API — на настоящем PostgreSQL через Testcontainers. H2 запрещён.
- Никаких выдуманных данных: характеристики берутся только из `frontend/content/products.ts`, который собран по официальным датащитам.
- Пароли и секреты не попадают в репозиторий.

---

## File Structure

| Файл | Ответственность |
| --- | --- |
| `backend/compose.yaml` | PostgreSQL для разработки |
| `backend/pom.xml` | зависимости |
| `backend/src/main/resources/application.properties` | подключение к базе, порт, actuator |
| `backend/src/main/resources/db/migration/V1__catalog.sql` | схема каталога |
| `backend/src/main/resources/db/migration/V2__catalog_seed.sql` | данные 13 позиций, сгенерированы из `products.ts` |
| `backend/src/main/resources/db/migration/V3__admin_user.sql` | таблица учётных записей админки |
| `backend/tools/seed-catalog.mjs` | одноразовый генератор `V2`, читает `products.ts` |
| `.../portal/catalog/Category.java` | сущность категории |
| `.../portal/catalog/Product.java` | сущность изделия |
| `.../portal/catalog/ProductSpec.java` | строка характеристик |
| `.../portal/catalog/ProductRepository.java` | доступ к данным |
| `.../portal/catalog/CategoryRepository.java` | доступ к данным |
| `.../portal/catalog/CatalogQuery.java` | интерфейс модуля наружу |
| `.../portal/catalog/CatalogService.java` | реализация, правило «только опубликованное» |
| `.../portal/catalog/PublicCatalogController.java` | `/api/public/v1/**` |
| `.../portal/catalog/PublicDto.java` | ответы публичного API |
| `.../portal/common/ApiExceptionHandler.java` | `application/problem+json` |
| `.../portal/common/NotFoundException.java` | 404 домена |
| `.../portal/iam/AdminUser.java`, `AdminUserRepository.java` | учётные записи админки |
| `.../portal/iam/SecurityConfig.java` | правила доступа и форма входа |
| `.../portal/iam/AdminUserSeeder.java` | первый администратор из переменных окружения |
| `.../portal/admin/AdminCatalogController.java` | список и редактирование изделий |
| `src/main/resources/templates/admin/*.html` | Thymeleaf |
| `src/test/java/ru/vedal/portal/PostgresTestBase.java` | общий контейнер для тестов |

---

## Task 1: База, миграция и тестовая обвязка

**Files:**
- Create: `backend/compose.yaml`
- Modify: `backend/pom.xml`
- Modify: `backend/src/main/resources/application.properties`
- Create: `backend/src/main/resources/db/migration/V1__catalog.sql`
- Create: `backend/src/test/java/ru/vedal/portal/PostgresTestBase.java`
- Test: `backend/src/test/java/ru/vedal/portal/SchemaTest.java`

**Interfaces:**
- Consumes: ничего.
- Produces: `PostgresTestBase` — базовый класс тестов, поднимает PostgreSQL 16 и применяет миграции. Таблицы `category`, `product`, `product_category`, `product_spec`.

- [ ] **Step 1: Поднять базу для разработки**

Создать `backend/compose.yaml`:

```yaml
services:
  db:
    image: postgres:16
    container_name: vedal-db
    environment:
      POSTGRES_DB: vedal
      POSTGRES_USER: vedal
      POSTGRES_PASSWORD: vedal
    ports:
      - "5434:5432"
    volumes:
      - vedal-db:/var/lib/postgresql/data

volumes:
  vedal-db:
```

Запустить: `docker compose -f backend/compose.yaml up -d`

- [ ] **Step 2: Добавить зависимости**

В `backend/pom.xml` внутрь `<dependencies>` добавить:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
```

Проверить, что всё разрешается: `cd backend && ./mvnw -q -DskipTests package`

- [ ] **Step 3: Настроить подключение**

Дописать в `backend/src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5434/vedal
spring.datasource.username=vedal
spring.datasource.password=vedal

# Схему ведёт Flyway. ddl-auto=update молча правит прод и ломает
# воспроизводимость восстановления из бэкапа.
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
```

- [ ] **Step 4: Написать миграцию схемы**

Создать `backend/src/main/resources/db/migration/V1__catalog.sql`:

```sql
create table category (
    id       uuid primary key,
    slug     text not null unique,
    name     text not null,
    position int  not null
);

create table product (
    id         uuid primary key,
    slug       text not null unique,
    name       text not null,
    kind       text not null,
    summary    text not null,
    detail     text,
    doc_status text not null check (doc_status in ('confirmed', 'pending')),
    published  boolean not null default false,
    sort_order int not null default 0,
    image_src  text,
    image_alt  text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table product_category (
    product_id  uuid not null references product (id) on delete cascade,
    category_id uuid not null references category (id) on delete restrict,
    primary key (product_id, category_id)
);

create table product_spec (
    id         uuid primary key,
    product_id uuid not null references product (id) on delete cascade,
    kind       text not null check (kind in ('key_param', 'spec')),
    position   int  not null,
    label      text not null,
    value      text not null,
    muted      boolean not null default false
);

create index product_published_idx on product (published, sort_order);
create index product_spec_product_idx on product_spec (product_id, kind, position);
```

- [ ] **Step 5: Написать падающий тест схемы**

Создать `backend/src/test/java/ru/vedal/portal/PostgresTestBase.java`:

```java
package ru.vedal.portal;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Настоящий PostgreSQL, а не H2: различия диалектов должны вылезать здесь,
// а не в проде. Контейнер один на все тесты — static.
@SpringBootTest
@Testcontainers
public abstract class PostgresTestBase {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");
}
```

Создать `backend/src/test/java/ru/vedal/portal/SchemaTest.java`:

```java
package ru.vedal.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;

class SchemaTest extends PostgresTestBase {

    @Autowired
    JdbcClient jdbc;

    @Test
    void migrationCreatesCatalogTables() {
        var tables = jdbc.sql("""
                        select table_name from information_schema.tables
                        where table_schema = 'public'
                        """)
                .query(String.class)
                .list();

        assertThat(tables).contains("category", "product", "product_category", "product_spec");
    }
}
```

- [ ] **Step 6: Убедиться, что тест падает по нужной причине**

Run: `cd backend && ./mvnw -q -Dtest=SchemaTest test`
Expected: FAIL, пока миграция не подхвачена — Flyway не найдёт файл или сборка не разрешит зависимость. Читать сообщение: если тест падает не на отсутствии таблиц, проблема в конфигурации, а не в схеме.

- [ ] **Step 7: Добиться зелёного теста**

Run: `cd backend && ./mvnw -Dtest=SchemaTest test`
Expected: `Tests run: 1, Failures: 0`

- [ ] **Step 8: Проверить, что приложение поднимается на живой базе**

Run: `cd backend && ./mvnw spring-boot:run`
Проверить: `curl -s http://localhost:8081/actuator/health` → `{"status":"UP",...}`
Остановить процесс. Если порт остался занят — найти JVM и завершить: Maven-обёртка форкает процесс и не всегда убивает его за собой.

- [ ] **Step 9: Коммит**

```bash
git add backend/compose.yaml backend/pom.xml backend/src/main/resources/application.properties backend/src/main/resources/db/migration/V1__catalog.sql backend/src/test/java/ru/vedal/portal/PostgresTestBase.java backend/src/test/java/ru/vedal/portal/SchemaTest.java
git commit -m "feat(back): подключить PostgreSQL и миграцию схемы каталога"
```

---

## Task 2: Сущности и репозитории каталога

**Files:**
- Create: `backend/src/main/java/ru/vedal/portal/catalog/Category.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/Product.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/ProductSpec.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/CategoryRepository.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/ProductRepository.java`
- Test: `backend/src/test/java/ru/vedal/portal/catalog/ProductRepositoryTest.java`

**Interfaces:**
- Consumes: `PostgresTestBase` из задачи 1.
- Produces: `ProductRepository.findByPublishedTrueOrderBySortOrderAscNameAsc()` → `List<Product>`; `ProductRepository.findBySlugAndPublishedTrue(String slug)` → `Optional<Product>`; `Product` с полями `id, slug, name, kind, summary, detail, docStatus, published, sortOrder, imageSrc, imageAlt, categories, specs`.

- [ ] **Step 1: Написать падающий тест репозитория**

Создать `backend/src/test/java/ru/vedal/portal/catalog/ProductRepositoryTest.java`:

```java
package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProductRepositoryTest extends PostgresTestBase {

    @Autowired
    ProductRepository products;

    @Test
    void hidesUnpublishedProducts() {
        products.save(published("vedal-test-visible", "Видимое", 1));
        products.save(hidden("vedal-test-hidden", "Скрытое", 2));

        var slugs = products.findByPublishedTrueOrderBySortOrderAscNameAsc()
                .stream().map(Product::getSlug).toList();

        assertThat(slugs).contains("vedal-test-visible");
        assertThat(slugs).doesNotContain("vedal-test-hidden");
        assertThat(products.findBySlugAndPublishedTrue("vedal-test-hidden")).isEmpty();
    }

    private static Product published(String slug, String name, int order) {
        var p = base(slug, name, order);
        p.setPublished(true);
        return p;
    }

    private static Product hidden(String slug, String name, int order) {
        return base(slug, name, order);
    }

    private static Product base(String slug, String name, int order) {
        var p = new Product();
        p.setId(UUID.randomUUID());
        p.setSlug(slug);
        p.setName(name);
        p.setKind("Тестовое изделие");
        p.setSummary("Тестовая позиция, в каталоге не показывается.");
        p.setDocStatus("pending");
        p.setSortOrder(order);
        return p;
    }
}
```

- [ ] **Step 2: Запустить и убедиться, что тест не компилируется**

Run: `cd backend && ./mvnw -q -Dtest=ProductRepositoryTest test`
Expected: FAIL — `cannot find symbol: class Product`

- [ ] **Step 3: Написать сущности**

`Category.java`:

```java
package ru.vedal.portal.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import java.util.UUID;

@Entity
public class Category {

    @Id
    private UUID id;
    private String slug;
    private String name;

    @Column(name = "position")
    private int position;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
```

`ProductSpec.java`:

```java
package ru.vedal.portal.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "product_spec")
public class ProductSpec {

    @Id
    private UUID id;

    // key_param — четыре строки под заголовком карточки, spec — таблица характеристик.
    private String kind;

    @Column(name = "position")
    private int position;

    private String label;
    private String value;
    private boolean muted;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public boolean isMuted() { return muted; }
    public void setMuted(boolean muted) { this.muted = muted; }
}
```

`Product.java`:

```java
package ru.vedal.portal.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
public class Product {

    @Id
    private UUID id;
    private String slug;
    private String name;
    private String kind;
    private String summary;
    private String detail;

    // Статус документации: рисует бейдж на сайте. Это НЕ видимость.
    @Column(name = "doc_status")
    private String docStatus;

    // Видимость снаружи.
    private boolean published;

    @Column(name = "sort_order")
    private int sortOrder;

    @Column(name = "image_src")
    private String imageSrc;

    @Column(name = "image_alt")
    private String imageAlt;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    @ManyToMany
    @JoinTable(name = "product_category",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    private List<Category> categories = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "product_id")
    @OrderBy("position asc")
    private List<ProductSpec> specs = new ArrayList<>();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public String getDocStatus() { return docStatus; }
    public void setDocStatus(String docStatus) { this.docStatus = docStatus; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public String getImageSrc() { return imageSrc; }
    public void setImageSrc(String imageSrc) { this.imageSrc = imageSrc; }
    public String getImageAlt() { return imageAlt; }
    public void setImageAlt(String imageAlt) { this.imageAlt = imageAlt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public List<Category> getCategories() { return categories; }
    public void setCategories(List<Category> categories) { this.categories = categories; }
    public List<ProductSpec> getSpecs() { return specs; }
    public void setSpecs(List<ProductSpec> specs) { this.specs = specs; }
}
```

- [ ] **Step 4: Написать репозитории**

`CategoryRepository.java`:

```java
package ru.vedal.portal.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findAllByOrderByPositionAsc();
}
```

`ProductRepository.java`:

```java
package ru.vedal.portal.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findByPublishedTrueOrderBySortOrderAscNameAsc();

    Optional<Product> findBySlugAndPublishedTrue(String slug);

    List<Product> findAllByOrderBySortOrderAscNameAsc();
}
```

- [ ] **Step 5: Прогнать тест**

Run: `cd backend && ./mvnw -Dtest=ProductRepositoryTest test`
Expected: PASS

- [ ] **Step 6: Коммит**

```bash
git add backend/src/main/java/ru/vedal/portal/catalog backend/src/test/java/ru/vedal/portal/catalog
git commit -m "feat(back): сущности и репозитории каталога"
```

---

## Task 3: Публичное API каталога

**Files:**
- Create: `backend/src/main/java/ru/vedal/portal/catalog/CatalogQuery.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/CatalogService.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/PublicDto.java`
- Create: `backend/src/main/java/ru/vedal/portal/catalog/PublicCatalogController.java`
- Create: `backend/src/main/java/ru/vedal/portal/common/NotFoundException.java`
- Create: `backend/src/main/java/ru/vedal/portal/common/ApiExceptionHandler.java`
- Test: `backend/src/test/java/ru/vedal/portal/catalog/PublicCatalogApiTest.java`

**Interfaces:**
- Consumes: `ProductRepository`, `CategoryRepository` из задачи 2.
- Produces: `CatalogQuery` с методами `publishedProducts()` → `List<PublicDto.Card>`, `publishedProduct(String slug)` → `PublicDto.Detail`, `categories()` → `List<PublicDto.CategoryView>`. Маршруты `GET /api/public/v1/categories`, `GET /api/public/v1/products`, `GET /api/public/v1/products/{slug}`.

- [ ] **Step 1: Написать падающий тест API**

Создать `backend/src/test/java/ru/vedal/portal/catalog/PublicCatalogApiTest.java`:

```java
package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class PublicCatalogApiTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository products;

    @Test
    void returnsOnlyPublishedProducts() throws Exception {
        products.save(product("api-visible", "Видимое", true));
        products.save(product("api-hidden", "Скрытое", false));

        mvc.perform(get("/api/public/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == 'api-visible')]").exists())
                .andExpect(jsonPath("$[?(@.slug == 'api-hidden')]").doesNotExist());
    }

    @Test
    void unpublishedProductIsNotFound() throws Exception {
        products.save(product("api-hidden-detail", "Скрытое", false));

        mvc.perform(get("/api/public/v1/products/api-hidden-detail"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Изделие не найдено"));
    }

    private static Product product(String slug, String name, boolean published) {
        var p = new Product();
        p.setId(UUID.randomUUID());
        p.setSlug(slug);
        p.setName(name);
        p.setKind("Тестовое изделие");
        p.setSummary("Тестовая позиция.");
        p.setDocStatus("pending");
        p.setPublished(published);
        return p;
    }
}
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && ./mvnw -q -Dtest=PublicCatalogApiTest test`
Expected: FAIL — 404 без тела problem+json на первом тесте, маршрута ещё нет.

- [ ] **Step 3: Написать ответы API**

`PublicDto.java`:

```java
package ru.vedal.portal.catalog;

import java.util.List;

// Наружу отдаём отдельные записи, а не сущности: иначе схема БД становится
// публичным контрактом и её нельзя менять, не ломая сайт.
public final class PublicDto {

    public record CategoryView(String slug, String name) {}

    public record SpecView(String label, String value, boolean muted) {}

    public record Card(String slug, String name, String kind, String summary,
                       String docStatus, List<String> categories,
                       String imageSrc, String imageAlt) {}

    public record Detail(String slug, String name, String kind, String summary,
                         String detail, String docStatus, List<String> categories,
                         String imageSrc, String imageAlt,
                         List<SpecView> keyParams, List<SpecView> specs) {}

    private PublicDto() {}
}
```

- [ ] **Step 4: Написать интерфейс и сервис модуля**

`CatalogQuery.java`:

```java
package ru.vedal.portal.catalog;

import java.util.List;

// Единственное, что модуль показывает соседям. Всё остальное — внутреннее.
public interface CatalogQuery {

    List<PublicDto.CategoryView> categories();

    List<PublicDto.Card> publishedProducts();

    PublicDto.Detail publishedProduct(String slug);
}
```

`CatalogService.java`:

```java
package ru.vedal.portal.catalog;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.NotFoundException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class CatalogService implements CatalogQuery {

    private final ProductRepository products;
    private final CategoryRepository categories;

    public CatalogService(ProductRepository products, CategoryRepository categories) {
        this.products = products;
        this.categories = categories;
    }

    @Override
    public List<PublicDto.CategoryView> categories() {
        return categories.findAllByOrderByPositionAsc().stream()
                .map(c -> new PublicDto.CategoryView(c.getSlug(), c.getName()))
                .toList();
    }

    @Override
    public List<PublicDto.Card> publishedProducts() {
        return products.findByPublishedTrueOrderBySortOrderAscNameAsc().stream()
                .map(CatalogService::toCard)
                .toList();
    }

    @Override
    public PublicDto.Detail publishedProduct(String slug) {
        // Неопубликованное для внешнего мира не существует: 404, а не 403 —
        // иначе по коду ответа видно, что такая позиция есть.
        var p = products.findBySlugAndPublishedTrue(slug)
                .orElseThrow(() -> new NotFoundException("Изделие не найдено"));
        return toDetail(p);
    }

    private static PublicDto.Card toCard(Product p) {
        return new PublicDto.Card(p.getSlug(), p.getName(), p.getKind(), p.getSummary(),
                p.getDocStatus(), names(p), p.getImageSrc(), p.getImageAlt());
    }

    private static PublicDto.Detail toDetail(Product p) {
        return new PublicDto.Detail(p.getSlug(), p.getName(), p.getKind(), p.getSummary(),
                p.getDetail(), p.getDocStatus(), names(p), p.getImageSrc(), p.getImageAlt(),
                specs(p, "key_param"), specs(p, "spec"));
    }

    private static List<String> names(Product p) {
        return p.getCategories().stream().map(Category::getName).toList();
    }

    private static List<PublicDto.SpecView> specs(Product p, String kind) {
        return p.getSpecs().stream()
                .filter(s -> kind.equals(s.getKind()))
                .map(s -> new PublicDto.SpecView(s.getLabel(), s.getValue(), s.isMuted()))
                .toList();
    }
}
```

- [ ] **Step 5: Написать формат ошибок**

`NotFoundException.java`:

```java
package ru.vedal.portal.common;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
```

`ApiExceptionHandler.java`:

```java
package ru.vedal.portal.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Один формат ошибок на все двери: application/problem+json, RFC 9457.
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail notFound(NotFoundException e) {
        var problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle(e.getMessage());
        return problem;
    }
}
```

- [ ] **Step 6: Написать контроллер**

`PublicCatalogController.java`:

```java
package ru.vedal.portal.catalog;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/public/v1")
public class PublicCatalogController {

    private final CatalogQuery catalog;

    public PublicCatalogController(CatalogQuery catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/categories")
    public ResponseEntity<List<PublicDto.CategoryView>> categories() {
        return cached(catalog.categories());
    }

    @GetMapping("/products")
    public ResponseEntity<List<PublicDto.Card>> products() {
        return cached(catalog.publishedProducts());
    }

    @GetMapping("/products/{slug}")
    public ResponseEntity<PublicDto.Detail> product(@PathVariable String slug) {
        return cached(catalog.publishedProduct(slug));
    }

    // Сборка сайта ходит сюда пачкой запросов — пусть кэшируется на стороне
    // клиента и прокси, а не бьёт в базу каждый раз.
    private static <T> ResponseEntity<T> cached(T body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(body);
    }
}
```

- [ ] **Step 7: Прогнать тесты**

Run: `cd backend && ./mvnw -Dtest=PublicCatalogApiTest test`
Expected: PASS, оба теста.

- [ ] **Step 8: Коммит**

```bash
git add backend/src/main/java/ru/vedal/portal/catalog backend/src/main/java/ru/vedal/portal/common backend/src/test/java/ru/vedal/portal/catalog
git commit -m "feat(back): публичное API каталога"
```

---

## Task 4: Перенос данных из фронтенда

**Files:**
- Create: `backend/tools/seed-catalog.mjs`
- Create: `backend/src/main/resources/db/migration/V2__catalog_seed.sql` (генерируется)
- Test: `backend/src/test/java/ru/vedal/portal/catalog/SeedTest.java`

**Interfaces:**
- Consumes: `ProductRepository` из задачи 2, схему из задачи 1.
- Produces: 5 категорий и 13 изделий в базе, все `published = true`.

- [ ] **Step 1: Написать генератор миграции**

Данные не переписываем руками: 13 позиций с характеристиками из датащитов — источник ошибок при ручном переносе. Node 24 читает TypeScript напрямую, отдельная сборка не нужна.

Создать `backend/tools/seed-catalog.mjs`:

```js
// Одноразовый генератор миграции V2 из frontend/content/products.ts.
// Запуск из корня репозитория:
//   node backend/tools/seed-catalog.mjs > backend/src/main/resources/db/migration/V2__catalog_seed.sql
import { products, categories } from "../../frontend/content/products.ts";
import { randomUUID } from "node:crypto";

const q = (v) => (v === undefined || v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const slugify = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");

const out = [];
out.push("-- Сгенерировано backend/tools/seed-catalog.mjs из frontend/content/products.ts.");
out.push("-- Править руками бессмысленно: перегенерировать и закоммитить заново.");
out.push("");

const categoryId = new Map();
categories.forEach((name, i) => {
  const id = randomUUID();
  categoryId.set(name, id);
  out.push(`insert into category (id, slug, name, position) values ('${id}', ${q(slugify(name))}, ${q(name)}, ${i});`);
});
out.push("");

products.forEach((p, i) => {
  const id = randomUUID();
  out.push(
    `insert into product (id, slug, name, kind, summary, detail, doc_status, published, sort_order, image_src, image_alt) values ` +
      `('${id}', ${q(p.slug)}, ${q(p.name)}, ${q(p.kind)}, ${q(p.summary)}, ${q(p.detail)}, ${q(p.status)}, true, ${i}, ${q(p.image?.src)}, ${q(p.image?.alt)});`
  );
  for (const c of p.categories) {
    out.push(`insert into product_category (product_id, category_id) values ('${id}', '${categoryId.get(c)}');`);
  }
  const rows = [
    ...(p.keyParams ?? []).map((s, j) => ["key_param", j, s]),
    ...(p.specs ?? []).map((s, j) => ["spec", j, s]),
  ];
  for (const [kind, j, s] of rows) {
    out.push(
      `insert into product_spec (id, product_id, kind, position, label, value, muted) values ` +
        `('${randomUUID()}', '${id}', '${kind}', ${j}, ${q(s.label)}, ${q(s.value)}, ${s.muted ? "true" : "false"});`
    );
  }
  out.push("");
});

process.stdout.write(out.join("\n"));
```

- [ ] **Step 2: Сгенерировать миграцию**

Run из корня репозитория:

```bash
node backend/tools/seed-catalog.mjs > backend/src/main/resources/db/migration/V2__catalog_seed.sql
```

Проверить глазами: `head -20 backend/src/main/resources/db/migration/V2__catalog_seed.sql`
Ожидается 5 строк `insert into category` и 13 блоков `insert into product`.

- [ ] **Step 3: Написать тест на состав каталога**

Создать `backend/src/test/java/ru/vedal/portal/catalog/SeedTest.java`:

```java
package ru.vedal.portal.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.vedal.portal.PostgresTestBase;

import static org.assertj.core.api.Assertions.assertThat;

class SeedTest extends PostgresTestBase {

    @Autowired
    ProductRepository products;

    @Autowired
    CategoryRepository categories;

    @Test
    void catalogIsSeededFromFrontendData() {
        assertThat(categories.findAllByOrderByPositionAsc()).hasSize(5);
        assertThat(products.findByPublishedTrueOrderBySortOrderAscNameAsc()).hasSize(13);
    }

    @Test
    void confirmedProductKeepsItsSpecs() {
        var r1 = products.findBySlugAndPublishedTrue("vedal-r1-r2").orElseThrow();

        assertThat(r1.getDocStatus()).isEqualTo("confirmed");
        assertThat(r1.getSpecs()).isNotEmpty();
        assertThat(r1.getCategories()).isNotEmpty();
    }
}
```

- [ ] **Step 4: Прогнать тест**

Run: `cd backend && ./mvnw -Dtest=SeedTest test`
Expected: PASS. Если счётчик 13 не сошёлся — не править тест, а проверить генератор: расхождение означает, что часть позиций не перенеслась.

Замечание: `ProductRepositoryTest` и `PublicCatalogApiTest` создают свои записи поверх сида. Прогнать весь набор целиком: `./mvnw test`. Если тесты мешают друг другу, добавить в них `@Transactional` — откат после каждого теста.

- [ ] **Step 5: Коммит**

```bash
git add backend/tools/seed-catalog.mjs backend/src/main/resources/db/migration/V2__catalog_seed.sql backend/src/test/java/ru/vedal/portal/catalog/SeedTest.java
git commit -m "feat(back): перенести каталог из фронтенда в миграцию"
```

---

## Task 5: Вход в админку

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__admin_user.sql`
- Create: `backend/src/main/java/ru/vedal/portal/iam/AdminUser.java`
- Create: `backend/src/main/java/ru/vedal/portal/iam/AdminUserRepository.java`
- Create: `backend/src/main/java/ru/vedal/portal/iam/SecurityConfig.java`
- Create: `backend/src/main/java/ru/vedal/portal/iam/AdminUserSeeder.java`
- Modify: `backend/pom.xml`
- Test: `backend/src/test/java/ru/vedal/portal/iam/AdminAccessTest.java`

**Interfaces:**
- Consumes: схему из задачи 1.
- Produces: `/admin/**` требует аутентификации, `/api/public/**` и `/actuator/health` открыты. Таблица `admin_user`. Первый администратор создаётся из переменных `VEDAL_ADMIN_USER` и `VEDAL_ADMIN_PASSWORD`.

- [ ] **Step 1: Добавить зависимости**

В `backend/pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
```

- [ ] **Step 2: Написать падающий тест доступа**

Создать `backend/src/test/java/ru/vedal/portal/iam/AdminAccessTest.java`:

```java
package ru.vedal.portal.iam;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AdminAccessTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Test
    void anonymousIsSentToLogin() throws Exception {
        mvc.perform(get("/admin/products")).andExpect(status().is3xxRedirection());
    }

    @Test
    void publicApiStaysOpen() throws Exception {
        mvc.perform(get("/api/public/v1/products")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "editor")
    void authenticatedUserSeesAdmin() throws Exception {
        mvc.perform(get("/admin/products")).andExpect(status().isOk());
    }
}
```

Добавить в `pom.xml` тестовую зависимость:

```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-test</artifactId>
    <scope>test</scope>
</dependency>
```

- [ ] **Step 3: Запустить и убедиться, что падает**

Run: `cd backend && ./mvnw -q -Dtest=AdminAccessTest test`
Expected: FAIL — после добавления Spring Security закрыто всё подряд, включая публичное API, а `/admin/products` ещё не существует.

- [ ] **Step 4: Написать миграцию и сущность**

`V3__admin_user.sql`:

```sql
create table admin_user (
    id            uuid primary key,
    username      text not null unique,
    password_hash text not null,
    display_name  text not null,
    enabled       boolean not null default true,
    created_at    timestamptz not null default now()
);
```

`AdminUser.java`:

```java
package ru.vedal.portal.iam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "admin_user")
public class AdminUser {

    @Id
    private UUID id;
    private String username;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    private boolean enabled = true;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
```

`AdminUserRepository.java`:

```java
package ru.vedal.portal.iam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AdminUserRepository extends JpaRepository<AdminUser, UUID> {

    Optional<AdminUser> findByUsername(String username);
}
```

- [ ] **Step 5: Написать конфигурацию доступа**

`SecurityConfig.java`:

```java
package ru.vedal.portal.iam;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(AdminUserRepository users) {
        return username -> users.findByUsername(username)
                .map(u -> User.withUsername(u.getUsername())
                        .password(u.getPasswordHash())
                        .disabled(!u.isEnabled())
                        .roles("ADMIN")
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    // Публичное API и health открыты, всё под /admin — по сессии.
    // Отдельный маршрут выбран сознательно: его можно целиком закрыть
    // на уровне прокси, не трогая приложение.
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/**", "/actuator/health", "/login").permitAll()
                        .requestMatchers("/admin/**").authenticated()
                        .anyRequest().denyAll())
                .formLogin(form -> form.defaultSuccessUrl("/admin/products", true))
                .logout(logout -> logout.logoutSuccessUrl("/login"))
                // Публичное API читающее и без cookie-сессии — CSRF там нечего защищать.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/public/**"))
                .build();
    }
}
```

- [ ] **Step 6: Написать создание первого администратора**

`AdminUserSeeder.java`:

```java
package ru.vedal.portal.iam;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

// Пароль приходит из окружения и в репозиторий не попадает.
// Если переменные не заданы, учётная запись не создаётся — падать не нужно,
// но и молча заводить известный всем пароль тоже.
@Configuration
public class AdminUserSeeder {

    @Bean
    ApplicationRunner createFirstAdmin(AdminUserRepository users,
                                       PasswordEncoder encoder,
                                       @Value("${vedal.admin.username:}") String username,
                                       @Value("${vedal.admin.password:}") String password) {
        return args -> {
            if (username.isBlank() || password.isBlank()) return;
            if (users.findByUsername(username).isPresent()) return;

            var user = new AdminUser();
            user.setId(UUID.randomUUID());
            user.setUsername(username);
            user.setPasswordHash(encoder.encode(password));
            user.setDisplayName(username);
            users.save(user);
        };
    }
}
```

Дописать в `application.properties`:

```properties
vedal.admin.username=${VEDAL_ADMIN_USER:}
vedal.admin.password=${VEDAL_ADMIN_PASSWORD:}
```

- [ ] **Step 7: Прогнать тест**

Run: `cd backend && ./mvnw -Dtest=AdminAccessTest test`
Expected: первые два теста PASS. Третий пока падает — страницы `/admin/products` ещё нет; он станет зелёным в задаче 6.

- [ ] **Step 8: Коммит**

```bash
git add backend/pom.xml backend/src/main/resources/db/migration/V3__admin_user.sql backend/src/main/resources/application.properties backend/src/main/java/ru/vedal/portal/iam backend/src/test/java/ru/vedal/portal/iam
git commit -m "feat(back): вход в админку и учётные записи"
```

---

## Task 6: Админка каталога

**Files:**
- Create: `backend/src/main/java/ru/vedal/portal/admin/AdminCatalogController.java`
- Create: `backend/src/main/resources/templates/admin/products.html`
- Create: `backend/src/main/resources/templates/admin/product-form.html`
- Test: `backend/src/test/java/ru/vedal/portal/admin/AdminCatalogTest.java`

**Interfaces:**
- Consumes: `ProductRepository` из задачи 2, доступ из задачи 5.
- Produces: `GET /admin/products` — список, `GET /admin/products/{id}` — форма, `POST /admin/products/{id}` — сохранение, `POST /admin/products/{id}/publish` — переключение видимости.

- [ ] **Step 1: Написать падающий тест редактирования**

Создать `backend/src/test/java/ru/vedal/portal/admin/AdminCatalogTest.java`:

```java
package ru.vedal.portal.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.catalog.ProductRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class AdminCatalogTest extends PostgresTestBase {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository products;

    @Test
    @WithMockUser(username = "editor")
    void unpublishingHidesProductFromPublicApi() throws Exception {
        var product = products.findBySlugAndPublishedTrue("vedal-r1-r2").orElseThrow();

        mvc.perform(post("/admin/products/" + product.getId() + "/publish").with(csrf()))
                .andExpect(status().is3xxRedirection());

        assertThat(products.findBySlugAndPublishedTrue("vedal-r1-r2")).isEmpty();
    }

    @Test
    @WithMockUser(username = "editor")
    void editingSummaryPersists() throws Exception {
        var product = products.findAllByOrderBySortOrderAscNameAsc().getFirst();

        mvc.perform(post("/admin/products/" + product.getId())
                        .param("name", product.getName())
                        .param("kind", product.getKind())
                        .param("summary", "Обновлённое описание.")
                        .param("detail", "")
                        .param("docStatus", product.getDocStatus())
                        .with(csrf()))
                .andExpect(status().is3xxRedirection());

        assertThat(products.findById(product.getId()).orElseThrow().getSummary())
                .isEqualTo("Обновлённое описание.");
    }
}
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `cd backend && ./mvnw -q -Dtest=AdminCatalogTest test`
Expected: FAIL — 404, маршрутов нет.

- [ ] **Step 3: Написать контроллер**

`AdminCatalogController.java`:

```java
package ru.vedal.portal.admin;

import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import ru.vedal.portal.catalog.ProductRepository;
import ru.vedal.portal.common.NotFoundException;

import java.time.Instant;
import java.util.UUID;

@Controller
@RequestMapping("/admin/products")
public class AdminCatalogController {

    private final ProductRepository products;

    public AdminCatalogController(ProductRepository products) {
        this.products = products;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("products", products.findAllByOrderBySortOrderAscNameAsc());
        return "admin/products";
    }

    @GetMapping("/{id}")
    public String form(@PathVariable UUID id, Model model) {
        model.addAttribute("product", find(id));
        return "admin/product-form";
    }

    @PostMapping("/{id}")
    @Transactional
    public String save(@PathVariable UUID id,
                       @RequestParam String name,
                       @RequestParam String kind,
                       @RequestParam String summary,
                       @RequestParam String detail,
                       @RequestParam String docStatus) {
        var product = find(id);
        product.setName(name);
        product.setKind(kind);
        product.setSummary(summary);
        product.setDetail(detail.isBlank() ? null : detail);
        product.setDocStatus(docStatus);
        product.setUpdatedAt(Instant.now());
        products.save(product);
        return "redirect:/admin/products";
    }

    // Публикация — отдельное действие, а не поле формы: снятие с публикации
    // убирает изделие с сайта, и это не должно случаться заодно с правкой текста.
    @PostMapping("/{id}/publish")
    @Transactional
    public String togglePublish(@PathVariable UUID id) {
        var product = find(id);
        product.setPublished(!product.isPublished());
        product.setUpdatedAt(Instant.now());
        products.save(product);
        return "redirect:/admin/products";
    }

    private ru.vedal.portal.catalog.Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Изделие не найдено"));
    }
}
```

- [ ] **Step 4: Написать шаблоны**

`templates/admin/products.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="ru">
<head>
    <meta charset="utf-8">
    <title>Каталог — админка VEDAL</title>
    <style>
        body { font: 15px/1.5 system-ui, sans-serif; margin: 32px; color: #12202a; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #dde5e2; }
        .off { color: #5e6b73; }
        button { font: inherit; padding: 6px 12px; cursor: pointer; }
    </style>
</head>
<body>
<h1>Каталог</h1>
<table>
    <tr><th>Изделие</th><th>Тип</th><th>Документация</th><th>На сайте</th><th></th></tr>
    <tr th:each="p : ${products}">
        <td><a th:href="@{/admin/products/{id}(id=${p.id})}" th:text="${p.name}">—</a></td>
        <td th:text="${p.kind}">—</td>
        <td th:text="${p.docStatus == 'confirmed'} ? 'подтверждена' : 'уточняется'">—</td>
        <td th:text="${p.published} ? 'да' : 'нет'" th:classappend="${p.published} ? '' : 'off'">—</td>
        <td>
            <form th:action="@{/admin/products/{id}/publish(id=${p.id})}" method="post">
                <button type="submit" th:text="${p.published} ? 'Снять с сайта' : 'Опубликовать'">—</button>
            </form>
        </td>
    </tr>
</table>
</body>
</html>
```

`templates/admin/product-form.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="ru">
<head>
    <meta charset="utf-8">
    <title>Изделие — админка VEDAL</title>
    <style>
        body { font: 15px/1.5 system-ui, sans-serif; margin: 32px; color: #12202a; }
        label { display: block; margin-top: 16px; font-weight: 600; }
        input, textarea, select { font: inherit; width: 100%; max-width: 640px; padding: 8px; }
        textarea { height: 120px; }
        button { font: inherit; margin-top: 20px; padding: 8px 16px; cursor: pointer; }
    </style>
</head>
<body>
<h1 th:text="${product.name}">Изделие</h1>
<form th:action="@{/admin/products/{id}(id=${product.id})}" method="post">
    <label>Название<input name="name" th:value="${product.name}"></label>
    <label>Тип изделия<input name="kind" th:value="${product.kind}"></label>
    <label>Краткое описание<textarea name="summary" th:text="${product.summary}"></textarea></label>
    <label>Развёрнутое описание<textarea name="detail" th:text="${product.detail}"></textarea></label>
    <label>Статус документации
        <select name="docStatus">
            <option value="confirmed" th:selected="${product.docStatus == 'confirmed'}">подтверждена</option>
            <option value="pending" th:selected="${product.docStatus == 'pending'}">уточняется</option>
        </select>
    </label>
    <button type="submit">Сохранить</button>
</form>
<p><a th:href="@{/admin/products}">К списку</a></p>
</body>
</html>
```

- [ ] **Step 5: Прогнать тесты задач 5 и 6**

Run: `cd backend && ./mvnw -Dtest='AdminCatalogTest,AdminAccessTest' test`
Expected: PASS, все пять тестов.

- [ ] **Step 6: Коммит**

```bash
git add backend/src/main/java/ru/vedal/portal/admin backend/src/main/resources/templates backend/src/test/java/ru/vedal/portal/admin
git commit -m "feat(back): админка каталога — список, правка и публикация"
```

---

## Task 7: Сборка целиком и документация

**Files:**
- Modify: `backend/README.md`
- Test: весь набор

- [ ] **Step 1: Прогнать полный набор тестов**

Run: `cd backend && ./mvnw test`
Expected: BUILD SUCCESS, все тесты зелёные. Если тесты мешают друг другу через общую базу — добавить `@Transactional` в классы тестов, которые пишут данные.

- [ ] **Step 2: Проверить вручную на живой базе**

```bash
docker compose -f backend/compose.yaml up -d
cd backend && VEDAL_ADMIN_USER=editor VEDAL_ADMIN_PASSWORD="$(openssl rand -base64 18)" ./mvnw spring-boot:run
```

Проверить:
- `curl -s http://localhost:8081/api/public/v1/products | head -c 400` — 13 позиций;
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/public/v1/products/no-such-slug` — 404;
- `curl -s -D- -o /dev/null http://localhost:8081/api/public/v1/products | grep -i cache-control` — `max-age=300`;
- открыть `http://localhost:8081/admin/products`, войти, снять позицию с публикации, убедиться, что она исчезла из публичного ответа.

- [ ] **Step 3: Обновить README серверной части**

В `backend/README.md` заменить раздел «Как запустить» на актуальный: поднять базу через `compose.yaml`, задать `VEDAL_ADMIN_USER` и `VEDAL_ADMIN_PASSWORD`, адреса публичного API и админки. Добавить строку про генератор `tools/seed-catalog.mjs` — что миграция `V2` генерируется, а не пишется руками.

- [ ] **Step 4: Коммит**

```bash
git add backend/README.md
git commit -m "docs: описать запуск серверной части с базой и админкой"
```

---

## Проверка плана по спеке

| Требование спеки | Где закрыто |
| --- | --- |
| Postgres, миграции Flyway | Задача 1 |
| Формат ошибок problem+json | Задача 3, шаг 5 |
| Тесты на настоящем Postgres | Задача 1, `PostgresTestBase` |
| Публичное API отдаёт только опубликованное | Задача 2 (репозиторий), задача 3 (тест) |
| `ETag`/`Cache-Control` на публичном API | Задача 3, шаг 6 — `Cache-Control`. `ETag` включается отдельно фильтром `ShallowEtagHeaderFilter`, вынесен в следующий этап: на 13 позициях выигрыш от него нулевой |
| `doc_status` и `published` — разные флаги | Задача 1 (схема), задача 6 (раздельные действия в админке) |
| Сид из `products.ts` | Задача 4 |
| Вход в админку, роли | Задача 5 |
| Секреты не в репозитории | Задача 5, шаг 6 — пароль из окружения |
| Модуль виден соседям только через интерфейс | Задача 3 — `CatalogQuery` |

Не входит в этот план и ждёт своих этапов: `content`, приём заявок, outbox, Kafka, документы, ассистент, переезд на инфраструктуру Яндекса.
