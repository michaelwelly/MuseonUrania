import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сотрудники и профиль.
//
// Оба экрана целиком построены вокруг одного вопроса: что портал о человеке
// знает по-настоящему, а что — нет.
//
// `StaffMember` несёт логин, имя и признак «учётная запись включена».
// Ни должности, ни ролей, ни присутствия там нет. В макете всё это
// на карточке, и соблазн заполнить велик: по должности решают, кому передать
// разговор, а по присутствию — ждать ответа или звонить. Выдуманное значение
// здесь опаснее пустого места, потому что по нему принимают решения.
//
// Отдельно — числа нагрузки. Все три двери теперь принимают отбор
// по ответственному, и все три числа настоящие. Раньше настоящим было
// одно — заявки, — а на месте сделок и разговоров стоял прочерк: ноль
// там читался бы как «сделок нет», а не как «посчитать нечем».
//
// Ноль по-прежнему должен доезжать нулём, а не превращаться в прочерк
// или в «…»: у сотрудника без единой сделки ноль — это ответ, а не пустота.

const mocks = vi.hoisted(() => ({
  leads: vi.fn(),
  deals: vi.fn(),
  chatsAll: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  leads: mocks.leads,
  deals: mocks.deals,
  chatsAll: mocks.chatsAll,
  audit: mocks.audit,
  staff: () =>
    Promise.resolve([
      { login: "i.koltsova", name: "Ирина Кольцова", enabled: true },
      { login: "a.rogov", name: "Антон Рогов", enabled: false },
      { login: "noname", name: null, enabled: true },
    ]),
}));

vi.mock("@/lib/auth", () => ({ logout: vi.fn() }));

import StaffPage from "./page";
import ProfilePage from "../profile/page";
import { WhoHost } from "../who";

beforeEach(() => {
  mocks.leads.mockReset().mockResolvedValue({
    items: [],
    page: 0,
    size: 1,
    total: 7,
    pages: 7,
  });
  mocks.deals.mockReset().mockResolvedValue({
    items: [],
    page: 0,
    size: 1,
    total: 3,
    pages: 3,
  });
  // Ноль — не пустота: у сотрудника может не быть ни одного разговора,
  // и это ответ на вопрос, а не отсутствие ответа.
  mocks.chatsAll.mockReset().mockResolvedValue({
    items: [],
    page: 0,
    size: 1,
    total: 0,
    pages: 0,
  });
  mocks.audit.mockReset().mockResolvedValue({
    items: [
      {
        id: "a1",
        at: "2026-08-21T09:30:00Z",
        actor: "i.koltsova",
        action: "lead.erased",
        subject: "lead",
        subjectId: null,
        correlationId: null,
        ip: null,
        payload: null,
      },
    ],
    page: 0,
    size: 8,
    total: 1,
    pages: 1,
  });
});

const Я = { actor: "i.koltsova", roles: ["portal-admin"], authentication: "keycloak" };

async function сотрудники() {
  render(
    <WhoHost who={Я}>
      <StaffPage />
    </WhoHost>,
  );
  await screen.findByText(/Ирина Кольцова/);
}

async function профиль() {
  render(
    <WhoHost who={Я}>
      <ProfilePage />
    </WhoHost>,
  );
  await screen.findByRole("heading", { name: "Ирина Кольцова" });
}

function карточка(имя: string) {
  return screen.getByText(new RegExp(имя)).closest("article")!;
}

describe("карточка сотрудника", () => {
  it("должность не выдумывает", async () => {
    await сотрудники();

    // По должности решают, кому передать разговор. Правдоподобная
    // «менеджер по продажам» — это решение, принятое по выдумке.
    expect(
      within(карточка("Ирина Кольцова")).getByText("должность ожидает уточнения"),
    ).toBeTruthy();
  });

  it("отключённый остаётся в списке и помечен", async () => {
    await сотрудники();

    const антон = карточка("Антон Рогов");
    expect(антон.className).toContain("person--off");
    expect(within(антон).getByText("отключён")).toBeTruthy();
    // На нём висят старые заявки и сделки: убрать его значит показать
    // их без ответственного.
    expect(within(антон).getByText(/на нём висят старые/i)).toBeTruthy();
  });

  it("своя карточка помечена словом, а не только рамкой", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    expect(своя.className).toContain("person--me");
    expect(within(своя).getByText("это вы")).toBeTruthy();
  });

  it("учётная запись без имени показывается логином", async () => {
    await сотрудники();

    // Пустое имя — обычное дело у служебной записи; показывать пустоту
    // на месте человека нельзя. Логин при этом стоит в карточке дважды —
    // именем и логином, — и это не ошибка: строка логина нужна и там,
    // где имя есть.
    expect(screen.getAllByText(/^noname$/).length).toBe(2);
  });
});

describe("нагрузка", () => {
  it("заявки — настоящим числом и с отбором по логину", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    // Сначала число, и только потом — с каким отбором его спросили.
    //
    // Порядок здесь важнее, чем кажется. Число приезжает отдельным запросом
    // на карточку, и проверка вызова, поставленная первой, спрашивает
    // о нём раньше, чем эффект успел сходить в портал. В одиночном прогоне
    // успевает, в полном — через раз: плавающий сторож хуже отсутствующего,
    // его перестают читать. `findByText` ждёт результата, и после него
    // вызов уже точно состоялся.
    expect(await within(своя).findByText("7")).toBeTruthy();
    expect(mocks.leads).toHaveBeenCalledWith({ owner: "i.koltsova" }, 0, 1);
  });

  it("сделки — настоящим числом и с отбором по логину", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    expect(await within(своя).findByText("3")).toBeTruthy();
    expect(within(своя).getByText("сделки")).toBeTruthy();
    expect(mocks.deals).toHaveBeenCalledWith({ owner: "i.koltsova" }, 0, 1);
  });

  it("разговоры — настоящим числом, и ноль остаётся нулём", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    // Ноль пришёл от портала и означает «ни одного разговора». Прочерк
    // на его месте означал бы «посчитать нечем» — это разные утверждения,
    // и подменить одно другим значит соврать про рабочий день человека.
    expect(await within(своя).findByText("0")).toBeTruthy();
    expect(within(своя).getByText("разговоров")).toBeTruthy();
    expect(within(своя).queryByText("—")).toBeNull();
    expect(mocks.chatsAll).toHaveBeenCalledWith("i.koltsova", 0, 1);
  });

  it("на число можно посмотреть: каждое ведёт в свой отобранный список", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    // Дожидаемся последнего из трёх чисел: до него ссылки на месте, но
    // проверять разметку в середине загрузки — способ поймать её в двух
    // разных состояниях в двух разных прогонах.
    await within(своя).findByText("0");

    const адреса = Array.from(своя.querySelectorAll("a.load")).map((a) =>
      a.getAttribute("href"),
    );

    // Число нагрузки без перехода — число, на которое нельзя посмотреть.
    //
    // Слеш перед вопросительным знаком проверяется как необязательный:
    // в разметке он есть (trailingSlash: true в next.config.ts), а Link,
    // отрисованный без конфигурации Next, его срезает. Прибить здесь одну
    // из двух форм значило бы проверять поведение испытательного стенда,
    // а не адрес, по которому уходит человек.
    expect(адреса).toHaveLength(3);
    for (const [i, где] of ["leads", "deals", "chats"].entries()) {
      expect(адреса[i]).toMatch(
        new RegExp("^/admin/" + где + "/?[?]owner=i[.]koltsova$"),
      );
    }
  });
});

describe("профиль", () => {
  it("незаполненное названо словами, а не прочерком", async () => {
    await профиль();

    // Почта, телефон и даты живут в системе входа и в токен не приезжают.
    expect(screen.getAllByText("ожидает уточнения").length).toBeGreaterThanOrEqual(4);
  });

  it("про роли сказано, что они дают одно и то же", async () => {
    await профиль();

    // SecurityConfig пускает обе роли ко всему админскому API одним
    // правилом. Показать разные права значило бы дать ложное чувство
    // границы: сотрудник решит, что редактор чего-то не может.
    expect(screen.getByText(/дают\s+одно и то же/)).toBeTruthy();
  });

  it("заводить сотрудников портал не умеет, и это сказано", async () => {
    await профиль();

    expect(screen.getByText(/консоль системы входа, а не портал/)).toBeTruthy();
  });

  it("последние действия берутся по вошедшему", async () => {
    await профиль();

    expect(mocks.audit).toHaveBeenCalledWith({ actor: "i.koltsova" }, 0, 8);
    expect(screen.getByText("Уничтожил персональные данные заявки")).toBeTruthy();
  });
});
