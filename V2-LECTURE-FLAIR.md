# Constante V2 — Lecture, Flair et sauvegardes

État : préparation, non déployée. Le schéma reste V2 ; les modules Lecture et Flair ont chacun leur version 1. Training est inchangé. La référence V1 et son empreinte restent figées.

Lecture : minimum d’une page, objectif initial de cinq minutes, livres facultatifs, quatre jours souhaités par semaine (modifiable), historique. Trois séances faciles atteignant la durée augmentent l’objectif d’une minute ; deux retours difficiles le diminuent. Le minimum ne pousse pas à augmenter. Le chronomètre et la séance sont conservés lors de la fermeture.

Flair : huit fiches de fondamentaux, working flair et premiers combos ; séances guidées d’environ vingt minutes, prérequis, essais sur dix et révisions. Deux jours différents avec au moins 8/10 propres valident un mouvement ; une révision est proposée après quatorze jours. Les fiches renvoient vers les vidéos en anglais de Chris sur FlairBartending.TV. Les combos sont des routines originales utilisant ces composants. Le parcours avancé d’exhibition reste à développer.

Les modules s’ajoutent après une copie locale de l’état V1.5, sans modifier l’objet Training. Pause et réactivation conservent les données. L’export contient tous les univers ; l’import contrôle le fichier et demande confirmation avant remplacement. Les identifiants de connexion sont exclus de l’export. Aucun fichier utilisateur n’est inclus dans ce dépôt.

## Sauvegarde en ligne

Le projet Supabase `constante-backups` est provisionné via Vercel Marketplace, offre gratuite, région Paris (`eu-west-3`). La table et les politiques du fichier `supabase/001_backups.sql` sont appliquées. La configuration source contient uniquement l’URL et la clé publiable, jamais la clé de service.

Le test SQL transactionnel réel valide l’insertion et la lecture par le propriétaire, puis l’absence de visibilité depuis un autre compte. Les comptes et les copies de test sont annulés par rollback. Les droits sont limités à SELECT et INSERT pour les utilisateurs authentifiés, avec les politiques `auth.uid() = user_id` ; aucun droit anonyme ni modification/suppression via l’application.

L’offre gratuite utilise les modèles d’e-mails Supabase par défaut : lien à usage unique. Pour connecter l’app installée, l’utilisateur copie le lien du bouton de l’e-mail et le colle dans Mon compte sans l’ouvrir. L’app vérifie l’origine, le type de lien et l’adresse du compte, puis échange le jeton auprès de Supabase. L’envoi initial à l’adresse choisie a été accepté par le serveur ; la validation par l’utilisateur et le premier envoi réel restent à terminer. Une configuration SMTP personnalisée permettrait ultérieurement des e-mails de marque avec codes courts. Ne pas contourner les restrictions des modèles gratuits.

Sur un nouvel appareil, restaurer d’abord la dernière copie, puis activer les envois pour cet appareil. L’application n’effectue aucune fusion automatique. Les exports excluent les jetons de connexion. Les éventuelles limites d’envoi du service gratuit doivent être prises en compte avant d’ouvrir l’application à d’autres utilisateurs.

Avant mise en production : terminer la connexion et vérifier un envoi réel puis sa restauration ; vérifier la configuration d’URL de retour si la connexion par ouverture directe du lien est ajoutée. La connexion actuelle attend le collage du lien dans l’app.

Un envoi est déclenché après modification locale lorsque l’app est ouverte, avec reprise après panne réseau. L’interface ne confirme la sauvegarde qu’après lecture de son identifiant sur le serveur. Ce mécanisme ne s’exécute pas lorsque l’app est fermée. Les copies s’accumulent ; prévoir une politique de conservation et vérifier les quotas avant utilisation durable.

## Validation

`node --test tests/*.test.js` : 22 tests, dont les 240 combinaisons de comportement comparées à la V1, l’ajout idempotent, les échecs de stockage, les restaurations, les progressions Lecture/Flair, le démarrage et la navigation, les échecs et confirmations cloud simulés. `node scripts/build.js` produit `dist/` et vérifie l’empreinte V1. Test réel d’isolation SQL réussi ; connexion et sauvegarde depuis un appareil encore en validation.

Sources pédagogiques :
- https://flairbartending.tv/flair-lesson-1-the-drop/
- https://flairbartending.tv/flair-lesson-2-back-of-the-hand-cradle/
- https://flairbartending.tv/flair-lesson-3-change-grip-circle-into-pour/
- https://flairbartending.tv/flair-lesson-20-tin-spin/
- https://flairbartending.tv/flair-lesson-21-tin-roll-down-arm/
- https://flairbartending.tv/flair-lesson-16-the-stall/
