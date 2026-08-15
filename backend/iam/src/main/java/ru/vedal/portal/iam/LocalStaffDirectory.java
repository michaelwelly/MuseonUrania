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
                .map(u -> new Person(u.getUsername(), u.getDisplayName(), u.isEnabled()))
                .sorted(Comparator.comparing(Person::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
