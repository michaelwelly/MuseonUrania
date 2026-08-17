# common

[Русский](README.md) · **English**

Shared across all modules: base types, API errors, validation rules, time and
identifier handling.

Rule: only what two or more modules need lands here. With a single consumer, the
code stays with that consumer.

## Build module

`portal-common` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: nothing.

External: Kafka and actuator — nothing else sees them.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
