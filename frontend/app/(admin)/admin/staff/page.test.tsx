import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  assignRoles: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  leads: mocks.leads,
  deals: mocks.deals,
  chatsAll: mocks.chatsAll,
  audit: mocks.audit,
  assignRoles: mocks.assignRoles,
  staff: () =>
    Promise.resolve([
      // Роли разные намеренно: список, где у всех одно и то же, зеленел бы
      // и на карточке, которая роли не показывает вовсе.
      { login: "i.koltsova", name: "Ирина Кольцова", enabled: true, roles: ["portal-admin"] },
      { login: "a.rogov", name: "Антон Рогов", enabled: false, roles: ["portal-sales"] },
      { login: "noname", name: null, enabled: true, roles: [] },
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
  mocks.assignRoles.mockReset().mockResolvedValue([]);
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

async function сотрудники(роли: string[] = ["portal-admin"]) {
  render(
    <WhoHost who={{ ...Я, roles: роли }}>
      <StaffPage />
    </WhoHost>,
  );
  await screen.findByText(/Ирина Кольцова/);
}

/** Карточка названного человека — по логину, который в ней стоит. */
function карточкаПо(логин: string): HTMLElement {
  return screen.getByText(логин).closest("article") as HTMLElement;
}

/** Кнопка-чип роли на карточке. Нет кнопки — значит редактора там нет. */
function чип(логин: string, роль: string): HTMLButtonElement | undefined {
  return [...карточкаПо(логин).querySelectorAll("button")].find(
    (b) => b.textContent === роль,
  ) as HTMLButtonElement | undefined;
}

async function профиль(роли: string[] = ["portal-admin"]) {
  render(
    <WhoHost who={{ ...Я, roles: роли }}>
      <ProfilePage />
    </WhoHost>,
  );
  await screen.findByRole("heading", { name: "Ирина Кольцова" });
}

/** Пункт списка «что можно»: открыт он или стоит с прочерком. */
function можно(текст: string): boolean {
  const строка = screen.getByText(new RegExp(текст)).closest("li")!;
  return строка.className.includes("check__row--on");
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

  // Роль сотрудника раньше можно было узнать только в консоли Keycloak.
  //
  // Проверяются обе стороны: и что роль показана, и что её отсутствие
  // названо словами. Карточка, рисующая на месте ролей пустоту, прошла бы
  // проверку «portal-admin на экране есть».
  it("роли видны на карточке, а их отсутствие названо словами", async () => {
    await сотрудники();

    // Своя карточка — только показ, поэтому роль там ровно одна и текстом.
    expect(within(карточкаПо("i.koltsova")).getByText("portal-admin")).toBeTruthy();
    expect(screen.getByText("в портал не пущен")).toBeTruthy();
  });

  // ————— выдача ролей —————

  // Набор уходит ЦЕЛИКОМ, а не «добавь одну»: дверь принимает его так же.
  // Проверяется именно аргумент, а не факт вызова — запрос с половиной
  // набора молча снял бы роль, которую никто не трогал.
  it("администратор выдаёт роль, и набор уходит целиком", async () => {
    await сотрудники();

    const user = userEvent.setup();
    await user.click(чип("a.rogov", "portal-production")!);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(mocks.assignRoles).toHaveBeenCalledWith("a.rogov", [
        "portal-sales",
        "portal-production",
      ]),
    );
  });

  // Кнопки нет, пока ничего не изменилось: роль решает, что человек видит
  // в закрытом контуре, и «Сохранить» на нетронутой карточке приглашает
  // нажать не глядя.
  it("кнопка появляется только после изменения", async () => {
    await сотрудники();

    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();

    const user = userEvent.setup();
    await user.click(чип("a.rogov", "portal-admin")!);

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeTruthy();
  });

  // Ограничение №3 со стороны интерфейса. Запирает его портал — он
  // отказывает на любую попытку сменить роли себе, — а здесь мы просто
  // не показываем кнопку, которая привела бы к отказу.
  it("свои роли не редактируются", async () => {
    await сотрудники();

    expect(чип("i.koltsova", "portal-sales")).toBeUndefined();
  });

  // Ограничение №1 со стороны интерфейса: редактора нет ни у кого, кроме
  // администратора. Проверка на одном администраторе зеленела бы и на
  // редакторе, показанном всем подряд.
  it("продавец редактора не видит вовсе", async () => {
    await сотрудники(["portal-sales"]);

    expect(чип("a.rogov", "portal-production")).toBeUndefined();
    expect(within(карточкаПо("a.rogov")).getByText("portal-sales")).toBeTruthy();
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

  // Список «что можно» раньше был прошит: пять пунктов, четыре всегда «да».
  // Тогда это была правда — ролей было две и обе пускали ко всему. Теперь
  // ролей три, и делят они контуры, а прошитый список стал враньём:
  // продавец читал у себя в профиле, что ему можно править каталог.
  //
  // Проверяются обе стороны. Тест на одном администраторе зеленел бы
  // и на прежнем списке, где «да» стоит у всех и всегда.
  it("администратору открыты оба контура и журнал", async () => {
    await профиль();

    expect(можно("Править каталог")).toBe(true);
    expect(можно("Вести заявки")).toBe(true);
    expect(можно("Читать журнал")).toBe(true);
  });

  it("продавцу не обещают правку каталога и журнал", async () => {
    await профиль(["portal-sales"]);

    expect(можно("Вести заявки")).toBe(true);
    expect(можно("Править каталог")).toBe(false);
    expect(можно("Читать журнал")).toBe(false);
  });

  it("заводить сотрудников портал не умеет, и это сказано", async () => {
    await профиль();

    expect(screen.getByText(/консоль системы входа, а не портал/)).toBeTruthy();
  });

  // Профиль открыт любой роли, а журнал и заявки — нет. Раньше их спрашивали
  // всегда: продавец читал текст ошибки 403 прямо у себя на профиле,
  // а у контура сайта вечно крутилась плитка заявок.
  //
  // Проверяется не только текст на экране, но и то, что запроса НЕ БЫЛО.
  // Проверка одного текста зеленела бы и на прежнем коде: там ошибка тоже
  // рисовалась, просто другими словами.
  it("продавцу журнал не показывают и не спрашивают", async () => {
    await профиль(["portal-sales"]);

    expect(mocks.audit).not.toHaveBeenCalled();
    expect(screen.getByText(/Журнал открыт администратору/)).toBeTruthy();
  });

  it("контуру сайта не спрашивают заявки", async () => {
    await профиль(["portal-production"]);

    expect(mocks.leads).not.toHaveBeenCalled();
    expect(screen.getByText(/заявки ведёт контур продаж/)).toBeTruthy();
  });

  it("последние действия берутся по вошедшему", async () => {
    await профиль();

    expect(mocks.audit).toHaveBeenCalledWith({ actor: "i.koltsova" }, 0, 8);
    expect(screen.getByText("Уничтожил персональные данные заявки")).toBeTruthy();
  });
});
