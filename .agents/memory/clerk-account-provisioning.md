---
name: Création de comptes Clerk
description: Décision d’authentification pour les comptes enseignants et étudiants.
---

La création de compte public est désactivée. L’administrateur crée un utilisateur depuis Master Class; le serveur crée alors le compte Clerk et ne persiste jamais le mot de passe dans PostgreSQL.

**Why:** L’établissement doit contrôler les accès des enseignants et des étudiants au lieu de permettre une auto-inscription.

**How to apply:** Toute nouvelle création d’utilisateur doit passer par l’API serveur et Clerk; ne jamais ajouter de champ de mot de passe dans une réponse API ou une table locale. Après connexion, ne pas demander à l’utilisateur de choisir un rôle : le profil local actif est vérifié côté serveur puis l’interface redirige automatiquement vers l’espace correspondant.

La modification administrative d’un mot de passe passe par une action serveur Clerk dédiée, protégée par l’administrateur actif; le mot de passe est reçu uniquement pour l’appel Clerk, puis n’est ni journalisé, ni renvoyé, ni persisté localement.

**Why:** Clerk ne permet pas de consulter les mots de passe existants; séparer l’action de réinitialisation de la mise à jour du profil réduit le risque de fuite et permet de gérer explicitement les erreurs de politique de mot de passe.

**How to apply:** Vérifier l’association `clerkUserId` avant l’appel Clerk, valider au moins huit caractères côté contrat et interface, et révoquer les autres sessions par défaut.

Une adresse e-mail locale ne doit pas rester liée à une ancienne identité Clerk si l’utilisateur se reconnecte avec une autre identité vérifiée; détacher l’ancien `clerkUserId` permet la liaison JIT sécurisée au compte courant.

**Why:** La résolution locale refuse volontairement les conflits d’association au lieu de choisir arbitrairement entre plusieurs identités Clerk portant la même adresse.

**How to apply:** Lors d’un changement ou d’une récupération de compte, vérifier les conflits d’identité, conserver le profil local unique, puis laisser la prochaine requête authentifiée établir la nouvelle liaison.