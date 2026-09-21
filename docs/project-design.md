# Yellow Jacket - document de conception et feuille de route

**Version du document : 0.1 - 21 septembre 2026**  
**Projet :** `yellow-jacket`  
**Dépôt principal :** `https://github.com/Loxime/yellow-jacket`  
**Miroir de publication :** `https://gitlab.rusanor.fr/inquest/inquest-dev/yellow-jacket`

## 1. Introduction

Yellow Jacket est un outil de régression HTTP orienté développeur. Son objectif est de rendre visible l'impact réel d'une modification applicative avant qu'elle soit fusionnée ou poussée : une suite de requêtes est exécutée contre les pages et routes d'une application, les réponses sont enregistrées comme référence, puis comparées lors des exécutions suivantes.

Le problème visé est simple : un changement local peut casser une fonctionnalité distante du code modifié. Ce risque augmente avec la taille du projet, le nombre de contributeurs, la fréquence des livraisons et l'utilisation de génération de code par IA. Les tests unitaires et les tests ciblés restent indispensables, mais ils ne montrent pas toujours qu'une route qui fonctionnait hier répond désormais différemment.

Yellow Jacket cherche donc à fournir un garde-fou très proche du cycle Git : installation locale, configuration versionnée dans le dépôt, exécution en ligne de commande, code de sortie exploitable par les hooks et la CI, puis rapport statique lisible par un humain.

La référence ergonomique est Husky : un outil petit, installable dans le projet, qui ne demande ni serveur permanent, ni Docker, ni application graphique pour être utile.

## 2. Périmètre produit

### 2.1 Ce que Yellow Jacket doit faire

- exécuter des requêtes HTTP `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` et `OPTIONS` ;
- vérifier des attentes explicites, en commençant par le status HTTP ;
- sauvegarder une baseline représentant un comportement connu comme valide ;
- comparer une exécution courante avec cette baseline ;
- signaler les changements de status, de contenu, de structure ou de headers selon les règles configurées ;
- gérer des scénarios chaînés : création d'une ressource, récupération d'un identifiant, modification, lecture et suppression ;
- calculer une notion de couverture des routes lorsqu'un univers de routes est connu ;
- s'intégrer aux hooks Git et aux pipelines CI ;
- produire un rapport terminal, JSON puis HTML statique ;
- rester simple à installer dans un projet existant.

### 2.2 Ce que Yellow Jacket ne cherche pas à remplacer

Yellow Jacket n'a pas vocation à remplacer un navigateur E2E, un outil de charge, une plateforme complète de gestion d'API ou les tests unitaires. Sa spécialité est la **détection de régressions comportementales HTTP entre deux états du logiciel**.

Cette limite est volontaire : garder un rôle précis permet de conserver une CLI petite et une adoption comparable à celle de Husky.

## 3. Principes de conception inspirés de Husky

Husky est installé comme dépendance de développement et son initialisation crée une configuration locale au dépôt. La commande `husky init` automatise notamment la création du hook et la mise à jour du script `prepare`. Husky peut également être désactivé avec `HUSKY=0`.

Yellow Jacket reprend les principes, pas le code :

1. **Local-first** - les données essentielles vivent dans le dépôt.
2. **Installable** - `npm install --save-dev yellow-jacket` puis une commande d'initialisation.
3. **CLI-first** - l'interface web est un rapport ou une documentation, pas une dépendance d'exécution.
4. **Git-friendly** - les fichiers utiles sont versionnables et les codes de sortie sont exploitables par Git et la CI.
5. **No daemon / no Docker** - aucune infrastructure permanente n'est requise.
6. **Désactivable explicitement** - un futur `YELLOW_JACKET=0` permettra de contourner volontairement un hook local.
7. **Faible surface de dépendances** - utiliser les API natives de Node tant qu'elles répondent correctement au besoin.

## 4. Choix techniques

### 4.1 Runtime : Node.js 24 LTS

Le runtime cible est **Node.js 24 LTS**, avec une version minimale de `24.12.0` pour la première ligne de développement. Au 21 septembre 2026, Node 24 est LTS alors que Node 26 est encore Current. Pour un outil de développement installé dans de nombreux projets, une ligne LTS réduit les changements de comportement inattendus et suit la recommandation de Node d'utiliser les versions LTS pour les applications de production.

Node est particulièrement adapté ici car l'écosystème visé est déjà npm/JavaScript/TypeScript. Il fournit nativement `fetch`, `AbortSignal`, `util.parseArgs` et `node:test`, ce qui permet de garder le runtime du package presque sans dépendances.

**Pourquoi pas Bun ?** Bun apporte de très bonnes performances et une expérience intégrée, mais imposerait un runtime moins universel dans les projets npm existants. Yellow Jacket doit pouvoir être ajouté dans un projet Node sans demander un second runtime.

**Pourquoi pas Deno ?** Deno est cohérent techniquement, mais son modèle de permissions et son histoire d'import diffèrent du flux npm classique que l'outil veut rejoindre directement.

**Pourquoi pas Go ou Rust ?** Un binaire autonome serait performant et robuste, mais ferait perdre une partie de l'ergonomie de configuration TypeScript et augmenterait la barrière de contribution pour la cible principale. Ces langages peuvent devenir pertinents plus tard pour un moteur spécialisé, mais ne sont pas nécessaires au MVP.

### 4.2 Langage : TypeScript, distribution en JavaScript ESM

Le code source est écrit en TypeScript avec `strict` activé. Les utilisateurs bénéficient ainsi de types sur la configuration et, à terme, sur les extensions et reporters. Le package publié distribue du JavaScript ESM et des déclarations `.d.ts` : Node n'a pas à exécuter du TypeScript depuis `node_modules`.

Node 24.12 stabilise le type stripping TypeScript pour les syntaxes effaçables. Yellow Jacket pourra donc accepter une configuration `yellow-jacket.config.ts` légère sans loader tiers sur Node 24.12+, mais `yellow-jacket init` génère pour l'instant un fichier `.mjs`. Ce choix par défaut est plus conservateur : il évite de dépendre des subtilités de `tsconfig.json` que le type stripping natif de Node ne lit pas.

### 4.3 Modules : ESM

Le package utilise `"type": "module"` et `NodeNext`. ESM est le format naturel des versions modernes de Node et simplifie l'import dynamique du fichier de configuration. Le coût est une discipline plus stricte sur les extensions de fichiers et les chemins ; ce coût est acceptable pour un nouveau projet.

### 4.4 HTTP : `fetch` natif

Le runner utilise `fetch` fourni par Node plutôt qu'Axios. Pour le besoin actuel - méthodes HTTP, headers, body, timeout et lecture de réponse - les API natives suffisent.

**Avantages :**

- zéro dépendance runtime supplémentaire ;
- API Web connue des développeurs front et back ;
- gestion standard de `AbortSignal.timeout` ;
- moins de surface de maintenance et de supply chain.

**Limite :** certaines fonctionnalités avancées d'un client spécialisé devront être développées explicitement si elles deviennent nécessaires, par exemple des politiques de retry complexes ou certains détails de proxy.

### 4.5 CLI : `node:util.parseArgs`

Le CLI démarre avec `parseArgs` au lieu de Commander, Yargs ou CAC. Les premières commandes sont courtes (`init`, `run`, `baseline`) et ne justifient pas encore une dépendance dédiée.

Ce choix doit être réévalué si la CLI devient profondément imbriquée, si elle nécessite une génération d'aide sophistiquée ou une compatibilité de parsing plus large.

### 4.6 Tests internes : `node:test` + `node:assert`

Le test runner natif de Node est stable depuis Node 20. Il couvre le besoin initial sans Jest ou Vitest. Les tests de Yellow Jacket utilisent de vrais serveurs HTTP locaux temporaires afin de vérifier le runner dans des conditions proches de son usage réel.

Cela n'interdit pas Vitest à long terme ; l'objectif est de ne pas ajouter une dépendance tant que le runner natif suffit.

### 4.7 Stockage : fichiers JSON versionnables, aucune base de données

La baseline est un fichier JSON. Une base de données locale ou distante compliquerait l'installation et contredirait le principe local-first. Les données volumineuses ou historiques pourront être externalisées plus tard via des reporters ou artefacts CI.

La V1 doit privilégier des snapshots lisibles et déterministes. Le travail critique sera la normalisation : ignorer les timestamps, identifiants de requête, tokens ou champs explicitement dynamiques.

### 4.8 Documentation et interface : VitePress + GitHub Pages

La documentation et les rapports statiques seront déployés sans backend. VitePress correspond bien à un produit technique : documentation Markdown, navigation, recherche et build statique. Son guide fournit un workflow GitHub Pages basé sur `actions/configure-pages`, `upload-pages-artifact` et `deploy-pages`.

GitHub Pages accepte les déploiements par GitHub Actions et convient donc à une documentation ou à un rapport HTML statique. Il n'est pas utilisé comme serveur d'exécution des tests : les requêtes Yellow Jacket sont exécutées localement ou en CI.

## 5. Comparaison avec les alternatives

Le but n'est pas de prétendre que Yellow Jacket est universellement meilleur. Le bon critère est : **quel outil est le plus adapté au problème précis de régression HTTP locale, baseline/diff et intégration Git ?**

### 5.1 Hurl

Hurl est l'alternative la plus proche fonctionnellement. Il exécute des requêtes HTTP décrites dans un format texte, sait chaîner les requêtes, capturer des valeurs et effectuer des assertions sur les réponses. Il possède déjà un mode de test efficace.

**Hurl est meilleur aujourd'hui pour :** un DSL HTTP mature, des assertions nombreuses, une exécution déjà éprouvée et un format texte compact.

**Yellow Jacket vise un meilleur ajustement pour :** une configuration TypeScript intégrée au projet, une baseline comportementale automatique, un diff de régression centré sur les changements entre commits, un coverage de routes et un hook Git conçu comme fonctionnalité de premier ordre.

Conséquence produit : Yellow Jacket doit éviter de réinventer inutilement toutes les assertions de Hurl. Un import ou un mode d'interopérabilité Hurl pourra devenir une extension pertinente.

### 5.2 Playwright

Playwright sait tester directement une API via `APIRequestContext` et excelle surtout dans les parcours navigateur de bout en bout.

**Playwright est meilleur pour :** tester l'expérience utilisateur, DOM, navigation, authentification navigateur et scénarios mêlant UI et API.

**Yellow Jacket est plus adapté pour :** un garde-fou HTTP rapide à lancer avant un push, sans navigateur, sans fixture E2E complète et avec comparaison automatique à une baseline.

Les deux outils sont complémentaires : un projet peut utiliser Yellow Jacket à chaque push et Playwright pour ses parcours critiques.

### 5.3 Postman / Newman / Postman CLI

Newman exécute des collections Postman depuis la ligne de commande et s'intègre à la CI. Postman apporte une interface de conception et de collaboration très riche. La documentation actuelle précise toutefois que Newman n'est pas compatible avec le format Collection v3 de Postman v12 et oriente les nouveaux workflows vers Postman CLI.

**Postman est meilleur pour :** exploration manuelle, collaboration API, collections partagées, documentation et environnement graphique.

**Yellow Jacket est plus adapté pour :** rester entièrement dans le dépôt source, relire la configuration en code review, installer un package npm sans compte ni workspace externe et traiter la régression comme un diff de comportement lié au commit.

### 5.4 Grafana k6

k6 est conçu avant tout pour le test de performance, de charge, de stress et de résilience. Il sait aussi envoyer des requêtes HTTP et effectuer des checks.

**k6 est meilleur pour :** latence, SLO, utilisateurs virtuels, throughput, stress, soak tests et montée en charge.

**Yellow Jacket est plus adapté pour :** détecter qu'une route a changé fonctionnellement après une modification, même avec un seul appel. Les métriques de performance pourront être ajoutées sous forme de seuils simples, mais Yellow Jacket ne doit pas devenir un concurrent de k6 sur la charge.

### 5.5 Tableau de positionnement

| Besoin | Yellow Jacket | Hurl | Playwright | Postman/CLI | k6 |
|---|---|---|---|---|---|
| Baseline + diff automatique entre états | Cœur du produit | À composer | À coder | À coder | À coder |
| Requêtes HTTP simples | Oui | Excellent | Oui | Excellent | Oui |
| Scénarios chaînés | Cible V1 | Oui | Oui | Oui | Oui |
| Tests navigateur | Non | Non | Excellent | Limité | Possible orienté perf |
| Charge / stress | Non | Limité | Non | Non spécialisé | Excellent |
| Git hook local | Cœur du produit | Scriptable | Scriptable | Scriptable | Scriptable |
| Route coverage | Cible produit | Non central | Non central | Non central | Non central |
| Config proche du code TS/JS | Oui | DSL `.hurl` | Oui | Collection | JS/TS spécifique k6 |
| Zéro service requis | Oui | Oui | Oui | Newman oui | Oui |

## 6. Architecture fonctionnelle

Le modèle principal reste volontairement court :

```text
configuration
    |
    v
route/scenario definitions
    |
    v
HTTP runner
    |
    +--------> assertions explicites
    |
    v
response normalization
    |
    +--------> baseline.json
    |
    v
comparison engine
    |
    +--------> terminal reporter
    +--------> JSON reporter
    +--------> HTML reporter
    |
    v
exit code Git / CI
```

### 6.1 Baseline

Une baseline stocke le comportement connu comme valide. Elle ne doit pas contenir aveuglément tout ce qui est retourné : la normalisation doit supprimer ou ignorer les champs non déterministes.

La baseline courante du prototype stocke : route, méthode, URL, status, content-type, body et durée. La durée n'est pas encore comparée car elle nécessite des seuils plutôt qu'une égalité stricte.

### 6.2 Moteur de comparaison

Le prototype compare actuellement :

- status HTTP ;
- body, avec sérialisation stable des clés JSON ;
- content-type.

Les étapes suivantes ajouteront :

- chemins JSON ignorés ;
- règles de matching (`type`, regex, subset, schema) ;
- headers inclus/exclus ;
- HTML normalisé ;
- redirections ;
- seuils de latence ;
- diagnostic de route ajoutée ou supprimée.

### 6.3 Scénarios

Les méthodes destructives imposent une gestion d'état. La cible est une API de scénario permettant de capturer une valeur dans une réponse et de la réutiliser :

```ts
scenario('user lifecycle', ({ request, capture }) => {
  request('create', { method: 'POST', path: '/users', body: { email: 'test@example.dev' } })
  capture('userId', '$.id')
  request('read', { method: 'GET', path: '/users/{{ userId }}' })
  request('delete', { method: 'DELETE', path: '/users/{{ userId }}' })
})
```

Les actions destructives devront être refusées sur les hôtes non autorisés par défaut. Une option explicite sera nécessaire pour les environnements distants.

## 7. Git, GitHub et GitLab

### 7.1 Topologie de dépôts

Le dépôt GitHub est la source utilisée en lecture et en écriture :

```text
origin
  fetch -> https://github.com/Loxime/yellow-jacket.git
  push  -> https://github.com/Loxime/yellow-jacket.git
```

GitLab sert de destination de publication secondaire :

```text
gitlab
  push -> https://gitlab.rusanor.fr/inquest/inquest-dev/yellow-jacket.git
```

Git recommande l'usage de remotes séparés lorsque la récupération et la publication visent des endroits différents. Le projet conserve donc `origin` et `gitlab` au lieu de masquer les deux destinations dans un unique remote.

Le script `scripts/setup-remotes.sh` configure cette topologie après le clone local.

### 7.2 Flux local prévu

```bash
cd ~/project
git clone https://github.com/Loxime/yellow-jacket.git
cd yellow-jacket
./scripts/setup-remotes.sh
```

Puis :

```bash
git pull origin main
git push origin main
git push gitlab main
```

Une commande `npm run sync` pourra être ajoutée lorsque le comportement de synchronisation sera stabilisé. Le push GitLab dépendra des credentials ou du token configuré sur la machine du développeur.

### 7.3 Intégration Git de Yellow Jacket

Une étape ultérieure ajoutera :

- `yellow-jacket install` ;
- hook `pre-push` ;
- détection de branche et SHA ;
- mode `YELLOW_JACKET=0` ;
- exécution ciblée si la configuration le permet ;
- messages de diagnostic courts et actionnables.

## 8. État actuel de l'initialisation

Le dépôt initial contient déjà un MVP technique exécutable :

- package npm ESM ;
- TypeScript strict ;
- CLI `yellow-jacket init` ;
- CLI `yellow-jacket run` ;
- CLI `yellow-jacket baseline` ;
- chargement d'une configuration `.ts`, `.mjs` ou `.js` ;
- exécution séquentielle des routes ;
- timeout par requête ;
- bodies texte et JSON ;
- attentes de status ;
- création de baseline JSON ;
- comparaison status/body/content-type ;
- code de sortie non nul en cas de régression ;
- tests avec serveur HTTP local ;
- workflow GitHub Actions ;
- script de configuration des remotes GitHub/GitLab.

Le prototype a été exécuté dans l'environnement de construction : les deux tests fonctionnels initiaux passent et la commande `init` génère la configuration attendue. L'installation complète des dépendances de développement n'a pas pu être finalisée dans cet environnement isolé. Le dépôt GitHub a été vérifié en lecture, mais l'intégration actuelle ne dispose pas de la permission d'écriture sur les contenus ; le premier push doit donc être réalisé depuis le poste local ou après ajustement des permissions de l'intégration.

## 9. Étapes de développement

Cette feuille de route est volontairement extensible. Les numéros identifient des blocs, pas des versions commerciales obligatoires.

### Étape 0 - Fondation du dépôt - démarrée

- [x] structure TypeScript/ESM ;
- [x] package npm ;
- [x] README ;
- [x] licence MIT ;
- [x] CI GitHub minimale ;
- [x] premiers tests ;
- [x] script de remotes GitHub/GitLab ;
- [ ] lockfile généré par un environnement avec accès npm ;
- [ ] conventions de commit et contribution.

### Étape 1 - Runner HTTP MVP - démarrée

- [x] GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS ;
- [x] headers globaux et par route ;
- [x] body JSON/texte ;
- [x] timeout ;
- [x] assertion de status ;
- [ ] redirections configurables ;
- [ ] TLS/proxy selon besoins réels ;
- [ ] filtrage d'une route ou d'un groupe depuis la CLI.

### Étape 2 - Baseline et diff fiable

- [x] baseline JSON initiale ;
- [x] comparaison status/body/content-type ;
- [ ] normalisation JSON ;
- [ ] `ignore` par JSONPath ou chemin simple ;
- [ ] masquage des secrets ;
- [ ] comparaison de subset ;
- [ ] schéma/type matching ;
- [ ] HTML normalisé ;
- [ ] diff lisible dans le terminal ;
- [ ] format de baseline versionné et migrations.

### Étape 3 - Scénarios et actions

- [ ] `scenario()` ;
- [ ] capture de valeurs ;
- [ ] interpolation de variables ;
- [ ] setup/teardown ;
- [ ] données temporaires ;
- [ ] protection des hôtes de production ;
- [ ] politique d'autorisation pour POST/PUT/PATCH/DELETE ;
- [ ] nettoyage après erreur.

### Étape 4 - Intégration Git façon Husky

- [ ] `yellow-jacket install` ;
- [ ] hook `pre-push` ;
- [ ] `YELLOW_JACKET=0` ;
- [ ] détection du repo root ;
- [ ] gestion worktrees/monorepos ;
- [ ] messages adaptés aux environnements non interactifs.

### Étape 5 - Coverage de routes

- [ ] définition formelle du coverage ;
- [ ] routes déclaratives ;
- [ ] import OpenAPI ;
- [ ] import `sitemap.xml` pour les pages GET ;
- [ ] routes couvertes/non couvertes ;
- [ ] méthodes couvertes/non couvertes ;
- [ ] seuil minimum en CI ;
- [ ] adapters framework seulement après validation du modèle générique.

### Étape 6 - Reporters

- [ ] terminal compact ;
- [ ] terminal détaillé ;
- [ ] JSON machine-readable ;
- [ ] JUnit éventuel pour CI ;
- [ ] rapport HTML statique ;
- [ ] artefact CI ;
- [ ] page de diff par route.

### Étape 7 - GitHub / GitLab

- [x] dépôt GitHub identifié et accès en lecture vérifié ;
- [x] topologie GitLab push-only préparée ;
- [ ] premier push GitHub depuis le poste local ou après autorisation d’écriture du connecteur ;
- [ ] premier push GitLab depuis le poste local avec authentification ;
- [ ] pipeline GitLab CI ;
- [ ] statuts de commit GitHub ;
- [ ] commentaires/summary de pull request si utile ;
- [ ] artefacts de rapport ;
- [ ] stratégie d'authentification minimale et documentée.

### Étape 8 - Documentation / GitHub Pages

- [ ] VitePress ;
- [ ] page d'accueil inspirée de la simplicité de Husky ;
- [ ] Getting started ;
- [ ] référence config ;
- [ ] scénarios ;
- [ ] baseline/diff ;
- [ ] Git hooks ;
- [ ] CI GitHub/GitLab ;
- [ ] sécurité ;
- [ ] déploiement GitHub Pages.

### Étape 9 - Durcissement et publication npm

- [ ] tests Windows/macOS/Linux ;
- [ ] Node 24 LTS en matrice ;
- [ ] tests de vrais projets fixtures ;
- [ ] tests d'erreurs réseau ;
- [ ] audit de package ;
- [ ] taille de tarball ;
- [ ] `npm pack --dry-run` ;
- [ ] stratégie semver ;
- [ ] provenance npm/CI si retenue ;
- [ ] première version publique.

### Étape 10 - Extensions à décider après usage réel

- [ ] plugin API ;
- [ ] import Hurl ;
- [ ] import OpenAPI avancé ;
- [ ] adapters Next/Nest/Express/Symfony/Laravel ;
- [ ] historique de performances léger ;
- [ ] comparaison entre branches/commits ;
- [ ] génération assistée de configuration à partir d'un trafic ou d'une spec.

## 10. Objectifs pédagogiques

Yellow Jacket est aussi un projet d'apprentissage. Chaque bloc doit permettre d'étudier un concept concret au lieu d'empiler des bibliothèques.

### 10.1 Concevoir un CLI de production

- parsing d'arguments ;
- codes de sortie ;
- messages d'erreur ;
- résolution du dossier courant ;
- configuration versionnée ;
- compatibilité CI/non interactive.

### 10.2 Approfondir HTTP

- sémantique GET/POST/PUT/PATCH/DELETE ;
- idempotence ;
- redirects ;
- content negotiation ;
- headers ;
- auth ;
- cookies ;
- timeouts ;
- méthodes destructives et sécurité.

### 10.3 Construire un moteur de snapshot/diff

- déterminisme ;
- canonicalisation JSON ;
- données dynamiques ;
- masquage ;
- granularité du diff ;
- compatibilité entre versions de snapshot.

### 10.4 Tester un outil de test

- serveur HTTP fixture ;
- tests de concurrence ;
- erreurs réseau ;
- timeouts ;
- tests de filesystem ;
- tests CLI ;
- tests end-to-end dans un faux dépôt Git.

### 10.5 Comprendre Git au-delà de `commit/push`

- hooks ;
- refs ;
- branches ;
- remotes ;
- worktrees ;
- SHA ;
- exit codes ;
- différence entre comportement local et CI.

### 10.6 Concevoir une intégration GitHub/GitLab propre

- GitHub Actions ;
- GitLab CI ;
- tokens et permissions minimales ;
- statuts ;
- artefacts ;
- résilience quand un provider est indisponible.

### 10.7 Publier un package maintenable

- ESM ;
- exports ;
- `.d.ts` ;
- `files` npm ;
- engines ;
- semver ;
- release ;
- documentation ;
- réduction de la supply chain.

### 10.8 Apprendre à arbitrer l'usage de l'IA

Le projet répond en partie aux régressions introduites dans un contexte où davantage de code est généré. L'objectif pédagogique n'est pas de bannir l'IA, mais de renforcer les boucles de vérification : une génération rapide doit être suivie d'une validation reproductible et observable.

## 11. Structure GitHub

### 11.1 Structure actuelle

```text
yellow-jacket/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   └── project-design.md
├── scripts/
│   └── setup-remotes.sh
├── src/
│   ├── commands/
│   │   └── init.ts
│   ├── core/
│   │   ├── baseline.ts
│   │   ├── config.ts
│   │   ├── runner.ts
│   │   └── types.ts
│   ├── cli.ts
│   └── index.ts
├── test/
│   └── runner.test.ts
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── tsconfig.json
```

### 11.2 Structure cible quand le produit grandira

```text
src/
├── cli/
├── commands/
├── core/
│   ├── runner/
│   ├── compare/
│   ├── normalize/
│   ├── scenario/
│   └── coverage/
├── git/
├── providers/
│   ├── github/
│   └── gitlab/
├── reporters/
└── public-api/

test/
├── unit/
├── integration/
├── e2e/
└── fixtures/

docs/
├── guide/
├── reference/
└── decisions/
```

Cette structure ne doit pas être créée prématurément. Tant que quelques fichiers suffisent, une arborescence compacte rend le projet plus facile à lire. Les dossiers sont extraits seulement lorsqu'un sous-domaine possède plusieurs responsabilités propres.

## 12. Conventions de développement proposées

- branche principale : `main` ;
- commits petits et testables ;
- pas de dépendance runtime ajoutée sans justification écrite ;
- chaque bug de comparaison doit produire un test de non-régression ;
- les snapshots sont versionnés par format ;
- les actions destructives sont sûres par défaut ;
- une fonctionnalité provider-specific ne doit pas polluer le core ;
- GitHub et GitLab restent des adaptateurs autour d'un moteur indépendant ;
- le rapport HTML doit pouvoir être ouvert depuis un fichier statique ;
- aucun besoin de Docker n'est introduit sans changement explicite du cahier des charges.

## 13. Journal de décisions techniques à maintenir

Le dépôt pourra ajouter des ADR courts dans `docs/decisions/`. Premières décisions à formaliser :

- ADR-001 : Node 24 LTS comme runtime de référence ;
- ADR-002 : ESM + TypeScript compilé, zéro dépendance runtime au MVP ;
- ADR-003 : snapshots JSON et pas de base de données ;
- ADR-004 : GitHub `origin`, GitLab remote de publication séparé ;
- ADR-005 : GitHub Pages réservé aux assets statiques ;
- ADR-006 : méthodes destructives interdites sur des hôtes non autorisés par défaut ;
- ADR-007 : Hurl/Playwright/k6/Postman considérés comme outils complémentaires plutôt que cibles à reproduire intégralement.

## 14. Références techniques vérifiées

- [1] Node.js Releases - statut LTS/Current : https://nodejs.org/en/about/previous-releases
- [2] Node.js TypeScript - type stripping stable dans Node 24.12 : https://nodejs.org/api/typescript.html
- [3] Node.js test runner - `node:test` stable depuis Node 20 : https://nodejs.org/api/test.html
- [4] Husky - installation et `husky init` : https://typicode.github.io/husky/get-started.html
- [5] Hurl - manuel, captures et assertions : https://hurl.dev/docs/manual.html
- [6] Playwright - API testing : https://playwright.dev/docs/api-testing
- [7] Postman - Newman CLI : https://learning.postman.com/docs/reference/newman-cli/command-line-integration-with-newman
- [8] Grafana k6 - documentation et positionnement performance : https://grafana.com/docs/k6/latest/
- [9] VitePress - déploiement GitHub Pages : https://vitepress.dev/guide/deploy
- [10] GitHub Pages - custom workflows : https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- [11] Git - remote URLs et push/fetch : https://git-scm.com/docs/git-remote et https://git-scm.com/docs/git-push

## 15. Backlog documentaire ouvert

Cette section est destinée à recevoir les prochaines étapes au fur et à mesure de l'implémentation, sans figer le document dans une conclusion définitive.

- ajouter les ADR réellement adoptés ;
- documenter le format de baseline v1 ;
- documenter la politique de sécurité des actions ;
- ajouter les benchmarks de temps de démarrage et taille du package ;
- ajouter les choix définitifs pour JSONPath/schema matching ;
- ajouter la stratégie OpenAPI et coverage ;
- ajouter les conventions de plugins/reporters ;
- documenter les workflows GitHub/GitLab après leur première exécution ;
- ajouter les retours d'usage et changements de priorité.
