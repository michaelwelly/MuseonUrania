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
// Отдельно — числа нагрузки. Заявки посчитать можно: у них есть отбор
// по ответственному. У сделок и разговоров такого отбора у портала нет,
// и ноль на их месте читался бы как «сделок нет», а не как «посчитать нечем».

const mocks = vi.hoisted(() => ({ leads: vi.fn(), audit: vi.fn() }));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  leads: mocks.leads,
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

    expect(mocks.leads).toHaveBeenCalledWith({ owner: "i.koltsova" }, 0, 1);

    const своя = карточка("Ирина Кольцова");
    // Число приезжает отдельным запросом на карточку — дожидаемся его,
    // а не проверяем в тот момент, когда на месте числа ещё многоточие.
    expect(await within(своя).findByText("7")).toBeTruthy();
  });

  it("сделки и разговоры — прочерк, а не ноль", async () => {
    await сотрудники();

    const своя = карточка("Ирина Кольцова");
    // «0 сделок» и «сделок посчитать нечем» — разные утверждения,
    // и второе здесь правда.
    expect(within(своя).getByText(/сделки: нет отбора/)).toBeTruthy();
    expect(within(своя).getByText(/разговоры: нет отбора/)).toBeTruthy();
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
