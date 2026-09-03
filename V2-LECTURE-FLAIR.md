# Constante V2 — Lecture, Flair et sauvegardes

État : préparation, non déployée. Le schéma reste V2 ; les modules Lecture et Flair ont chacun leur version 1. Training est inchangé. La référence V1 et son empreinte restent figées.

Lecture : minimum d’une page, objectif initial de cinq minutes, livres facultatifs, quatre jours souhaités par semaine (modifiable), historique. Trois séances faciles atteignant la durée augmentent l’objectif d’une minute ; deux retours difficiles le diminuent. Le minimum ne pousse pas à augmenter. Le chronomètre et la séance sont conservés lors de la fermeture.

Flair : huit fiches de fondamentaux, working flair et premiers combos ; séances guidées d’environ vingt minutes, prérequis, essais sur dix et révisions. Deux jours différents avec au moins 8/10 propres valident un mouvement ; une révision est proposée après quatorze jours. Les fiches renvoient vers les vidéos en anglais de Chris sur FlairBartending.TV. Les combos sont des routines originales utilisant ces composants. Le parcours avancé d’exhibition reste à développer.

Les modules s’ajoutent après une copie locale de l’état V1.5, sans modifier l’objet Training. Pause et réactivation conservent les données. L’export contient tous les univers ; l’import contrôle le fichier et demande confirmation avant remplacement. Les identifiants de connexion sont exclus de l’export. Aucun fichier utilisateur n’est inclus dans ce dépôt.

## Sauvegarde en ligne : configuration requise

Le client Supabase et le schéma sont préparés, mais le projet de stockage n’est pas encore provisionné. `src/cloud-config.js` reste vide et l’interface indique clairement que seule la sauvegarde locale est disponible. Ne pas présenter cette version comme permettant déjà la récupération sur un autre téléphone.

1. Créer un projet Supabase privé via Vercel Marketplace dans l’équipe propriétaire ; sélectionner une région européenne et confirmer les conditions/coûts avec le propriétaire.
2. Appliquer une fois `supabase/001_backups.sql`. Activer l’authentification par e-mail et configurer l’envoi de codes (`{{ .Token }}`) dans les modèles d’e-mail. Les codes évitent d’ouvrir une autre session Safari depuis l’app installée. Vérifier les restrictions et quotas d’envoi du fournisseur ; configurer un expéditeur de production si nécessaire.
3. Renseigner seulement l’URL publique Supabase et la clé publiable dans `src/cloud-config.js`. Ne jamais placer la clé de service ni de secret dans le site.
4. Vérifier sur le backend réel : un compte ne peut lire ou ajouter que ses propres copies ; aucun accès anonyme ; aucune modification/suppression des copies via le client. Tester OTP, renouvellement de session, panne réseau, reprise, export et restauration depuis un deuxième appareil avant activation.
5. L’utilisateur se connecte dans l’app puis choisit d’activer les envois sur cet appareil. Sur un appareil neuf, il restaure d’abord sa copie. Les instantanés sont distincts et immuables : pas de fusion automatique ni d’écrasement distant entre appareils.

Un envoi est déclenché après modification locale lorsque l’app est ouverte, avec reprise après panne réseau. L’interface ne confirme la sauvegarde qu’après lecture de son identifiant sur le serveur. Ce mécanisme ne s’exécute pas lorsque l’app est fermée. Les copies s’accumulent ; prévoir une politique de conservation et vérifier les quotas avant utilisation durable.

## Validation

`node --test tests/*.test.js` : 21 tests, dont les 240 combinaisons de comportement comparées à la V1, l’ajout idempotent, les échecs de stockage, les restaurations, les progressions Lecture/Flair, le démarrage et la navigation, les échecs et confirmations cloud simulés. `node scripts/build.js` produit `dist/` et vérifie l’empreinte V1. Aucun test cloud réel n’a encore été effectué.

Sources pédagogiques :
- https://flairbartending.tv/flair-lesson-1-the-drop/
- https://flairbartending.tv/flair-lesson-2-back-of-the-hand-cradle/
- https://flairbartending.tv/flair-lesson-3-change-grip-circle-into-pour/
- https://flairbartending.tv/flair-lesson-20-tin-spin/
- https://flairbartending.tv/flair-lesson-21-tin-roll-down-arm/
- https://flairbartending.tv/flair-lesson-16-the-stall/
