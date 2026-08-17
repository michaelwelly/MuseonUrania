# Debezium: outbox → Kafka

[Русский](README.md) · **English**

The connector reads the `outbox` table from the PostgreSQL write-ahead log and
puts every row into the topic named by its `type` column. The application does
not poll the outbox: with `vedal.events.publisher=debezium` the relay publishes
nothing, and events arrive in `KafkaOutboxListener`.

## Why this instead of the relay

The relay polled the table every five seconds. Event latency depended on the
poll interval, and load on the database was the same whether there were events
or not. The connector reads a log PostgreSQL writes anyway: events leave right
after `COMMIT`, and there are no idle queries at all.

The transactional outbox has not gone anywhere and cannot. The entity row and
the event row are still committed by one `COMMIT` — otherwise a gap opens
between the insert and the publish, and leads fall through it. Only the reader
of the table changed.

## Settings you should not change without thinking

| Key | Value | Why |
| --- | --- | --- |
| `skipped.operations` | `u,d,t` | The consumer stamps `published_at` in the same table. Without this its own `UPDATE` would come back into the topic, `EventRouter` could not route it, and the log would fill with warnings. |
| `snapshot.mode` | `no_data` | On first start the connector would otherwise re-read the whole table and re-send everything already sent. Duplicates are cut off by `event_consumed`, but the work is pointless. |
| `route.topic.replacement` | `${routedByValue}` | `type` already holds the full topic name (`vedal.leads.v1`). The default appends `.events` and sends events to topics nobody listens to. |
| `table.expand.json.payload` | `true` | `payload` is `jsonb`. Without expansion the topic receives a string with escaped quotes instead of an object. |
| `table.fields.additional.placement` | `aggregate`, `correlation_id` into headers | Without `correlationId` the request chain breaks at the broker boundary, and an email stops being linked to the lead that produced it. |

`EventRouter` puts the event id into the `id` header. That is what the consumer
uses to cut off duplicates — a message without that header goes to the DLQ
rather than being handled "somehow".

## Database requirements

```
wal_level = logical
max_replication_slots >= 1
max_wal_senders >= 1
```

`compose.yaml` sets these as PostgreSQL startup parameters. In the cloud they
are cluster settings; Managed PostgreSQL enables logical replication behind
a separate flag, and without it the connector will not start.

The connector's user needs the `REPLICATION` privilege. In the local stack that
is the database owner; in a deployed environment a separate role is created —
the connector needs no write access, and there is no reason to grant it.

## Registration

Done by the `connect-init` container in `compose.yaml`. By hand:

```bash
curl -X PUT -H "Content-Type: application/json" --data @backend/debezium/outbox-connector.json http://localhost:8083/connectors/vedal-outbox/config
```

`PUT .../config` rather than `POST /connectors`: it is idempotent, so restarting
the stack brings the configuration to whatever the file says instead of
answering "connector already exists". Hence the file's shape — **the config map
only**, without the `{"name": ..., "config": {...}}` wrapper: `POST` expects the
wrapper, while `PUT` answers `500` with an opaque deserialization message. The
connector name comes from the URL.

State:

```bash
curl -s http://localhost:8083/connectors/vedal-outbox/status
```

## What to look at when events stop flowing

1. **Outbox lag.** The `vedal.outbox.lag.seconds` metric. `published_at` is
   stamped by the consumer when the event comes back from the topic, so the lag
   measures the whole path: `COMMIT` → log → connector → topic → consumer.
   Growing lag means some leg is down, and this is the primary signal.
2. **Connector state** — `RUNNING` or `FAILED` in `/status`.
3. **Replication slot.** `select * from pg_replication_slots` — if the slot
   exists but the connector does not, PostgreSQL keeps the log and will one day
   fill the disk. A removed connector must be removed together with its slot.
4. **DLQ** — the `<topic>.dlq` topics. Whatever fails three attempts ends up
   there.
