[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-Hans.md) | **Español** | [Français](README.fr.md)

# PR Check Doctor

PR Check Doctor convierte los checks fallidos de un PR de GitHub en un único comentario de pull request con información concreta y accionable.

Es una GitHub Action self-hosted para el triage de CI. Recopila los check runs y workflow jobs fallidos, resume las líneas de log relevantes, oculta (redact) valores que parecen secretos, clasifica las causas probables del fallo y crea o actualiza un único comentario estable en el PR.

## Qué hace

- Recopila los check runs y workflow jobs correspondientes al head SHA del pull request.
- Sigue la paginación de la API de GitHub para que los conjuntos grandes de checks de un PR no se trunquen silenciosamente.
- Descarga los logs de los workflow jobs de los checks que necesitan triage.
- Oculta (redact) valores con forma de token, contraseña, API key o clave privada antes de renderizar los comentarios.
- Genera un veredicto de `PASS`, `WARN` o `BLOCK`.
- Actualiza el comentario existente de PR Check Doctor en lugar de publicar duplicados.
- Soporta modos dry-run y fixture para verificación local.

## Uso básico

Ejecuta PR Check Doctor después de los jobs que debe analizar. Usa `if: always()` para que se ejecute incluso si los jobs anteriores fallan.

```yaml
name: CI

on:
  pull_request:

permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  doctor:
    runs-on: ubuntu-latest
    needs:
      - test
    if: ${{ always() }}
    steps:
      - uses: actions/checkout@v4
      - uses: hjh6709/pr-check-doctor@v0
        with:
          github-token: ${{ github.token }}
```

`v0` sigue la última versión `v0.x.y`, por lo que recibe actualizaciones de patch y minor automáticamente. Para repositorios sensibles en materia de seguridad, fija la action a un commit SHA completo en lugar de una etiqueta mutable:

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## Configuración

Crea `.check-doctor.yml` para asignar nombres de checks a categorías y comandos de reproducción local.

```yaml
comment:
  mode: update
  language: en

checks:
  "npm test":
    category: test_failure
    local_command: npm test
    blocks_merge: true

  "lint":
    category: lint_failure
    local_command: npm run lint
    blocks_merge: true
```

Las claves de las reglas de check se comparan como subcadenas del nombre del check, sin distinguir mayúsculas de minúsculas. Usa `*` como comodín para que una sola regla coincida con las variantes de un matrix job, por ejemplo `"test (*)"` coincide con `test (ubuntu-latest, 18)`, `test (windows-latest, 20)`, etc.

Consulta `docs/configuration.md` para la referencia completa de configuración.

## Inputs

| Input | Requerido | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `github-token` | yes | | Token usado para leer checks, leer logs y escribir comentarios en el PR. |
| `config-path` | no | `.check-doctor.yml` | Ruta al archivo de configuración de PR Check Doctor. |
| `dry-run` | no | `false` | Muestra el resultado sin escribir un comentario en el PR. |
| `fixture-path` | no | | Ruta al fixture JSON usado con dry-run para verificar la Action localmente. |

## Permisos

Usa los permisos mínimos que necesite la action:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

`pull-requests: write` solo es necesario cuando la action escribe o actualiza el comentario del PR. Para workflows que solo hacen dry-run, usa `pull-requests: read`.

Consulta `docs/security.md` para notas de seguridad sobre permisos de token, extractos de log, redaction y pull requests desde forks.

## Pull Requests desde Forks

Un workflow disparado por `pull_request` recibe un `GITHUB_TOKEN` de solo lectura en los pull requests provenientes de forks, por lo que `pull-requests: write` falla ahí. Para dar soporte a PRs de forks, separa CI y PR Check Doctor en dos workflows: mantén CI en `pull_request` (seguro en forks), y dispara PR Check Doctor mediante `workflow_run` una vez que CI termina. `workflow_run` se ejecuta en el contexto del repositorio base, por lo que recibe un token normal con permiso de escritura, sin necesidad de hacer checkout ni ejecutar el código del fork en ningún momento.

```yaml
# .github/workflows/ci.yml — unchanged, still triggers on pull_request
name: CI

on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

```yaml
# .github/workflows/doctor.yml — new, triggers after CI completes
name: PR Check Doctor

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write

jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hjh6709/pr-check-doctor@v0
        with:
          github-token: ${{ github.token }}
```

`workflows: ["CI"]` debe coincidir con el `name:` del workflow de CI. PR Check Doctor resuelve automáticamente el pull request a partir del commit del workflow run; omite las ejecuciones que no fueron disparadas por un pull request (por ejemplo, un push directo a `main`) o que no tienen un pull request abierto asociado. Consulta `docs/security.md` para saber por qué este enfoque es más seguro que `pull_request_target`.

Si tu repositorio solo necesita pull requests del mismo repositorio (sin forks externos), la configuración de workflow único con `pull_request` de "Uso básico" es más simple y sigue estando totalmente soportada.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de desarrollo, los pasos de verificación y las convenciones de PR.

## Estado

PR Check Doctor está publicado en GitHub Marketplace desde la versión `v0.3.0`. Consulta `docs/release-checklist.md` para el proceso usado al publicar nuevas versiones.
