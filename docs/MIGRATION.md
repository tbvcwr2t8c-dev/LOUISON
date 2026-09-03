# Migration additive V1 → schéma V2

La version produit est V1.5 ; le format de stockage est `schemaVersion: 2` ; Training reste `version: 1`.

```json
{
  "schemaVersion": 2,
  "core": { "createdAt": "date ISO", "preferences": {} },
  "modules": {
    "training": { "enabled": true, "version": 1, "data": "état V1 intégral" }
  }
}
```

L’exemple est descriptif : `data` est en réalité l’objet V1 complet. Aucun recalcul des séances, des scores, des signaux ou des dates n’est réalisé. Les propriétés inconnues et l’ordre des tableaux sont conservés. Aucun module Flair, même vide, n’est installé.

## Premier chargement

1. Lire `constante_v2` et `constante` sans les modifier.
2. Si V2 existe : vérifier sa version et son intégrité ; ne pas recommencer la migration.
3. Si V2 est absente : vérifier V1, copier son objet complet dans Training.
4. Conserver `constante` intacte et écrire sa chaîne exacte dans `constante_v1_backup`, sans remplacer une sauvegarde différente.
5. Vérifier cette sauvegarde et l’égalité intégrale des données Training copiées.
6. Écrire V2 en une opération atomique, puis relire pour vérifier la chaîne enregistrée.
7. Les enregistrements suivants modifient seulement `constante_v2`.

Un nouvel utilisateur sans clé V1 conserve exactement les valeurs initiales de Training. Une clé présente mais illisible ne devient jamais une nouvelle progression vide. Une version future est refusée sans écriture.

## Erreurs et concurrence

Un échec de sauvegarde bloque les interactions et permet l’export brut des données encore enregistrées. La mutation Training non enregistrée en mémoire ne peut pas être soumise deux fois : recharger est nécessaire. Les données V1 originales sont toujours conservées.

Web Locks assure un seul onglet V1.5 écrivain par origine lorsque disponible. Chaque enregistrement vérifie également que V1/V2 n’ont pas changé depuis leur lecture ; les événements de stockage provenant d’un autre onglet arrêtent l’interface. Une page restaurée depuis le cache de navigation recharge pour reprendre le verrou.

Une ancienne page V1 n’utilise pas ce verrou : fermer les anciennes pages avant migration. Les changements V1 détectés après migration bloquent V1.5 pour éviter de choisir silencieusement entre deux progressions. Sur un navigateur sans Web Locks, les vérifications sont présentes mais ne garantissent pas l’exclusion de deux écritures parfaitement simultanées : utiliser un seul onglet.

## Sauvegarde externe

Réglages → Exporter mes données télécharge un JSON `constante-backup`, `backupVersion: 1`, avec la date d’export et les chaînes brutes des trois clés (`constante`, `constante_v1_backup`, `constante_v2`). La sauvegarde est aussi accessible lorsque Training est en pause ou qu’une donnée illisible bloque l’application.

Conserver le fichier dans Fichiers/iCloud Drive. Ce téléchargement n’est pas une synchronisation cloud automatique. La copie locale V1 n’est pas une sauvegarde hors appareil : effacer les données Safari l’effacerait aussi.

Il n’y a pas encore de bouton d’importation. Pour restaurer un export, il faudra une opération de restauration contrôlée sur le même appareil/origine : valider le fichier, sauvegarder d’abord les trois valeurs présentes, puis restaurer les valeurs du fichier sans écraser une progression plus récente par erreur. Ne pas modifier le stockage manuellement sans cette vérification.

## Retour arrière

- Avant toute publication : tester une copie de données réelle et télécharger un export depuis le navigateur de production. Aucun export personnel n’est à mettre dans Git.
- Conserver le domaine `constante-kohl.vercel.app` pour retrouver le stockage Safari existant. Un domaine de prévisualisation ou localhost ne peut pas lire ce stockage.
- Revenir au code V1 afficherait la progression à la date de migration, car V1 ne lit pas V2. **Ne pas déployer simplement la V1 après de nouvelles séances V1.5 en prétendant conserver ces nouvelles séances.**
- Pour conserver les séances V1.5 lors d’un retour au code V1 : exporter V1/V2, valider `modules.training.data`, comparer intégralement cet objet, puis effectuer une restauration explicite vers la clé V1. Cette opération n’est pas automatique et doit être revue avant exécution.
- Les tests ont validé la structure et le comportement avec des données synthétiques ; la progression réelle de l’utilisateur sur iPhone n’a pas été consultée.

## Module Registry

Une définition apporte `id`, `name`, `version` et `mount`. Le registre permet ajout, recherche et retrait d’une définition. L’état persistant est distinct : retirer une définition du catalogue conserve ses données. Une nouvelle version peut réenregistrer cette définition et retrouver son état. `enabled` est l’unique indicateur d’activation persistant, sans liste `activeModules` redondante.

La V1.5 n’installe que Training. Le montage initial conserve son interface ; la pause masque l’univers et propose sa réactivation. Une séance en cours doit être terminée avant la pause. Les règles métier ne sont pas déplacées dans le noyau.
