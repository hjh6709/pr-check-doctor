[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-Hans.md) | [Español](README.es.md) | **Français**

# PR Check Doctor

PR Check Doctor transforme les checks échoués d'une PR GitHub en un seul commentaire de pull request exploitable.

C'est une GitHub Action self-hosted dédiée au triage de CI. Elle collecte les check runs et workflow jobs en échec, résume les lignes de log utiles, masque (redact) les valeurs qui ressemblent à des secrets, classe les causes probables d'échec, puis crée ou met à jour un unique commentaire stable sur la PR.

## Ce qu'elle fait

- Collecte les check runs et workflow jobs pour le head SHA de la pull request.
- Suit la pagination de l'API GitHub afin que les grands ensembles de checks d'une PR ne soient pas tronqués silencieusement.
- Télécharge les logs des workflow jobs pour les checks nécessitant un triage.
- Masque (redact) les valeurs ressemblant à des tokens, mots de passe, clés API ou clés privées avant de générer les commentaires.
- Produit un verdict `PASS`, `WARN` ou `BLOCK`.
- Met à jour le commentaire PR Check Doctor existant au lieu d'en publier des doublons.
- Prend en charge les modes dry-run et fixture pour une vérification locale.

## Utilisation de base

Exécutez PR Check Doctor après les jobs qu'il doit analyser. Utilisez `if: always()` pour qu'il s'exécute même si les jobs précédents échouent.

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

`v0` suit la dernière version `v0.x.y`, ce qui permet de récupérer automatiquement les mises à jour patch et minor. Pour les dépôts sensibles en matière de sécurité, épinglez l'action sur un commit SHA complet plutôt que sur un tag mutable :

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## Configuration

Créez `.check-doctor.yml` pour associer les noms de checks à des catégories et à des commandes de reproduction locale.

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

Les clés des règles de check sont comparées comme des sous-chaînes insensibles à la casse par rapport au nom du check. Utilisez `*` comme joker pour faire correspondre les variantes d'un matrix job avec une seule règle, par exemple `"test (*)"` correspond à `test (ubuntu-latest, 18)`, `test (windows-latest, 20)`, etc.

Consultez `docs/configuration.md` pour la référence complète de configuration.

## Inputs

| Input | Requis | Valeur par défaut | Description |
| --- | --- | --- | --- |
| `github-token` | yes | | Token utilisé pour lire les checks, lire les logs et écrire les commentaires de PR. |
| `config-path` | no | `.check-doctor.yml` | Chemin du fichier de configuration de PR Check Doctor. |
| `dry-run` | no | `false` | Affiche le résultat sans écrire de commentaire sur la PR. |
| `fixture-path` | no | | Chemin du fixture JSON utilisé avec dry-run pour la vérification locale de l'Action. |

## Permissions

Utilisez les permissions minimales nécessaires à l'action :

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

`pull-requests: write` n'est nécessaire que lorsque l'action écrit ou met à jour le commentaire de PR. Pour les workflows en dry-run uniquement, utilisez `pull-requests: read`.

Consultez `docs/security.md` pour les notes de sécurité concernant les permissions de token, les extraits de log, le redaction et les pull requests provenant de forks.

## Pull Requests depuis des Forks

Un workflow déclenché par `pull_request` ne reçoit qu'un `GITHUB_TOKEN` en lecture seule sur les pull requests provenant de forks, donc `pull-requests: write` y échoue. Pour prendre en charge les PR de forks, séparez CI et PR Check Doctor en deux workflows : gardez CI sur `pull_request` (sûr sur les forks), et déclenchez PR Check Doctor via `workflow_run` une fois CI terminé. `workflow_run` s'exécute dans le contexte du dépôt de base, il reçoit donc un token normal avec droit d'écriture, sans jamais avoir besoin de checkout ni d'exécuter le code du fork.

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

`workflows: ["CI"]` doit correspondre au `name:` du workflow CI. PR Check Doctor résout automatiquement la pull request à partir du commit du workflow run ; il ignore les exécutions qui n'ont pas été déclenchées par une pull request (par exemple un push direct sur `main`) ou qui n'ont aucune pull request ouverte associée. Consultez `docs/security.md` pour comprendre pourquoi cette approche est plus sûre que `pull_request_target`.

Si votre dépôt n'a besoin que des pull requests internes (sans forks externes), la configuration à workflow unique `pull_request` de la section « Utilisation de base » ci-dessus est plus simple et reste entièrement prise en charge.

## Contribuer

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour le flux de développement, les étapes de vérification et les conventions de PR.

## Statut

PR Check Doctor est publié sur le GitHub Marketplace depuis la version `v0.3.0`. Consultez `docs/release-checklist.md` pour le processus utilisé pour publier de nouvelles versions.
