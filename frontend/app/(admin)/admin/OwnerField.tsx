"use client";

import { staff as loadStaff, type StaffMember } from "@/lib/admin";
import { Field, useLoad } from "./ui";

// Ответственный — выбор из справочника, а не свободная строка.
//
// Логин, написанный руками, ошибается молча: опечатка ничем не отличается
// от правильного логина, запись оказывается на человеке, которого нет,
// и не находится ни в одном фильтре по ответственному. Отказа нет, данные
// есть, они неверные.
//
// Три случая, которые список обязан пережить, не потеряв данные:
//
// 1. Пусто — «не назначен». Это нормальное состояние, а не пропуск.
// 2. Отключённый сотрудник. Остаётся в списке и помечен: на нём висят старые
//    сделки, и убрать его значит показать сделку без ответственного.
// 3. Логин, которого в справочнике нет вовсе, — уволенный до появления
//    справочника или та самая опечатка. Он тоже остаётся в списке отдельной
//    строкой: подставить вместо него пустоту значило бы стереть данные
//    при открытии формы, ничего не спросив.

export default function OwnerField({
  value,
  onChange,
  label = "Ответственный",
  hint,
}: {
  value: string;
  onChange: (login: string) => void;
  label?: string;
  hint?: string;
}) {
  const { data, error } = useLoad<StaffMember[]>(loadStaff);

  const people = data ?? [];
  const known = people.some((p) => p.login === value);

  return (
    <Field
      label={label}
      hint={
        error
          ? "Справочник сотрудников недоступен — можно оставить как есть."
          : (hint ?? "Пусто — ответственного нет.")
      }
    >
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— не назначен</option>

        {/* Незнакомый логин — первой строкой, чтобы выбранное значение
            было видно, а не выглядело как «не назначен». */}
        {value && !known && <option value={value}>{value} — нет в справочнике</option>}

        {people.map((p) => (
          <option key={p.login} value={p.login}>
            {p.name && p.name.trim() ? p.name : p.login}
            {p.enabled ? "" : " — отключён"}
          </option>
        ))}
      </select>
    </Field>
  );
}
