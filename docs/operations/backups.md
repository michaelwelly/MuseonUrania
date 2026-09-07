# Резервные копии

**Русский** · [English](backups.en.md)

## Что копируется

Только база. Заявки, клиенты, сделки, КП, разговоры и журнал аудита
существуют в одном экземпляре — в PostgreSQL. Файлы документов лежат
в объектном хранилище со своей избыточностью, образы и настройки
собираются из git заново.

## Как это устроено

`scripts/backup.sh`, запускается таймером `vedal-backup.timer` каждую ночь
в три часа по времени машины.

Один прогон делает четыре вещи:

1. Снимает дамп в формате `custom` (`pg_dump -Fc`) в `/var/backups/vedal/daily/`.
2. **Проверяет его восстановлением** — разворачивает во временную базу рядом
   и считает таблицы и заявки. Копия, которую никто не разворачивал, — это
   надежда, а не резерв: битый дамп выглядит как файл нужного размера ровно
   до того дня, когда он понадобится.
3. По понедельникам откладывает копию в `weekly/`.
4. Чистит старое: семь ежедневных, четыре недельных.

Прогон падает с ненулевым кодом, если дамп меньше десяти килобайт или
в восстановленной базе меньше двадцати таблиц. Молчаливо неудавшийся
бэкап хуже отсутствующего: на него рассчитывают.

## Чего пока нет

**Копии вне машины.** Скрипт умеет выгружать дампы в бакет, но для этого
нужен ключ с правом записи: тот, что лежит на ВМ сейчас, умеет только
читать. Без выгрузки потеря машины означает потерю и базы, и копий.

Включается двумя переменными в `backend/.env`:

```
VEDAL_BACKUP_S3_BUCKET=vedal-backups
VEDAL_S3_ACCESS_KEY=<ключ с ролью storage.editor>
VEDAL_S3_SECRET_KEY=<...>
```

## Установка на машине

```bash
sudo cp /opt/vedal-portal/scripts/vedal-backup.service /etc/systemd/system/
sudo cp /opt/vedal-portal/scripts/vedal-backup.timer /etc/systemd/system/
sudo mkdir -p /var/backups/vedal && sudo chown ubuntu:ubuntu /var/backups/vedal
sudo systemctl daemon-reload
sudo systemctl enable --now vedal-backup.timer
```

Проверить сразу, не дожидаясь ночи:

```bash
sudo systemctl start vedal-backup.service
journalctl -u vedal-backup -n 30 --no-pager
```

## Восстановление

```bash
# посмотреть, что есть
ls -la /var/backups/vedal/daily/

# развернуть в отдельную базу и убедиться, что там ожидаемое
docker exec vedal-db psql -U vedal -d postgres -c "CREATE DATABASE vedal_restore"
docker exec -i vedal-db pg_restore -U vedal -d vedal_restore --no-owner < <дамп>
docker exec vedal-db psql -U vedal -d vedal_restore -c "select count(*) from lead"
```

Заменять рабочую базу восстановленной — отдельное решение, а не шаг
инструкции: портал должен быть остановлен, а текущее состояние — снято
дампом до замены, каким бы испорченным оно ни казалось.

## Настройки

| Переменная | По умолчанию | Что делает |
| --- | --- | --- |
| `VEDAL_BACKUP_DIR` | `/var/backups/vedal` | куда складывать |
| `VEDAL_BACKUP_KEEP_DAILY` | `7` | сколько ежедневных держать |
| `VEDAL_BACKUP_KEEP_WEEKLY` | `4` | сколько недельных держать |
| `VEDAL_BACKUP_S3_BUCKET` | пусто | бакет для копий вне машины |
| `VEDAL_DB_CONTAINER` | `vedal-db` | имя контейнера с базой |
