package ru.vedal.portal.iam;

import java.util.Comparator;
import java.util.List;

// Справочник запасного режима: те же учётные записи, под которыми в него
// и входят, — таблица admin_user.
//
// Режим local существует для машины разработчика и для случая, когда
// Keycloak недоступен, а работать надо. Список здесь короткий и обычно
// состоит из одного человека, но пустым он быть не должен: выбор
// ответственного из пустого списка выглядит поломкой интерфейса.
class LocalStaffDirectory implements StaffDirectory {

    private final AdminUserRepository users;

    LocalStaffDirectory(AdminUserRepository users) {
        this.users = users;
    }

    @Override
    public List<Person> staff() {
        return users.findAll().stream()
                // Все три роли: запасной режим выдаёт их той же учётной записи,
                // что и SecurityConfig. Разойдись они, справочник показывал бы
                // не то, что портал на самом деле пускает.
                .map(u -> new Person(u.getUsername(), u.getDisplayName(), u.isEnabled(),
                        PORTAL_ROLES))
                .sorted(Comparator.comparing(Person::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    public void assignRoles(String login, List<String> roles) {
        // Запасной режим — это одна учётная запись с полными правами:
        // роли у неё не хранятся нигде, их выдаёт SecurityConfig списком.
        // Менять нечего, и молча делать вид, что получилось, нельзя:
        // человек решит, что роль снята, а портал продолжит пускать.
        throw new Rejected("Запасной режим входа ролями не управляет: "
                + "учётная запись в нём одна и получает все роли сразу. "
                + "Роли выдаются в Keycloak — включите vedal.iam.mode=keycloak.");
    }
}
