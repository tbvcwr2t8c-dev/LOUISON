> La branche V2 ajoute Lecture et Flair. Voir [le périmètre et les étapes de sauvegarde en ligne](V2-LECTURE-FLAIR.md). Le document ci-dessous décrit la référence V1.5.

# Constante — V1.5 Modular Core

Évolution additive du Training réellement publié sur https://constante-kohl.vercel.app.
La production n’a pas été modifiée. Aucun contenu Flair n’est ajouté.

## Références

- `main` et branche distante `v1-training-reference` : V1 publiée, récupérée telle quelle ; tag local `v1-training-reference` avec sa copie d’archive.
- `v1.5-modular-core` : version candidate avec stockage et modules.
- `reference/v1-training/index.html` : référence immuable, vérifiée par empreinte lors des tests et de la préparation de la version.
- `docs/RECOVERY.md` : provenance et limites de la récupération.
- `docs/MIGRATION.md` : format, sauvegarde, validation et retour arrière.

## Utilisation locale

Node.js 22 ou ultérieur. Aucune dépendance à installer.

```sh
npm test
npm run dev
npm run build
```

Ouvrir http://127.0.0.1:4173. La version statique est préparée dans `dist/`.
Le serveur de développement expose uniquement la page et les fichiers applicatifs, pas le dépôt ni les références.

La prévisualisation locale possède ses propres données : elle n’accède pas à celles de Safari sur l’iPhone.

## Fonctionnement

- `src/modules/training/training.js` : fonctions V1 encapsulées, mêmes calculs, textes, séances, graphiques et réglages.
- `src/core/storage.js` : copie additive, vérification, export brut, protection contre l’écrasement.
- `src/core/registry.js` : catalogue des modules, indépendant de leurs données.
- `src/app.js` : montage Training, sauvegarde, pause/réactivation, gestion des erreurs.

Les seuls raccordements dans le code Training sont la lecture initiale, l’enregistrement et l’ajout d’une carte dans Réglages. L’indicateur de version devient V1.5. Les données invalides et erreurs de stockage arrêtent désormais l’application au lieu d’autoriser un redémarrage susceptible de masquer ou écraser les données.

Le bouton historique de réinitialisation conserve son effet sur Training uniquement et sa confirmation. Il n’efface ni les autres modules ni la référence V1. La pause n’efface rien. Aucun mécanisme de purge globale n’est ajouté.

## Validation

13 tests automatisés, dont une comparaison V1/V1.5 couvrant 240 combinaisons de modes, ressentis, difficulté individuelle, ancienneté et disponibilité du rameur. Comparaison des états et du HTML généré ; tests des réglages, de la réinitialisation et des bornes basses ; tests de conservation des champs inconnus, pause/reprise, quotas, corruption et modifications concurrentes.

Ces tests utilisent des données synthétiques et un environnement DOM simulé. Ils ne remplacent pas la validation sur Safari/iPhone avec une copie sauvegardée des données réelles. Aucune progression personnelle n’a été récupérée ou publiée dans ce dépôt.

## GitHub

Le dépôt source est [tbvcwr2t8c-dev/LOUISON](https://github.com/tbvcwr2t8c-dev/LOUISON). Le connecteur est authentifié comme `tbvcwr2t8c-dev` et son installation est limitée à ce dépôt. `main` conserve la V1 ; `v1.5-modular-core` prépare l’évolution sans modifier le déploiement Vercel.
