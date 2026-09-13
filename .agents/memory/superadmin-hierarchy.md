---
name: Hiérarchie des rôles
description: Périmètre durable des super-administrateurs et administrateurs dans Master Class.
---

Le `superadmin` est un rôle de plateforme qui gère uniquement les comptes `admin`. Un `admin` gère uniquement ses enseignants, étudiants et classes; les affectations d’enseignants et d’étudiants doivent respecter le même périmètre côté serveur.

**Why:** La séparation doit rester effective même lorsqu’un utilisateur appelle directement l’API, et non seulement depuis la navigation de l’interface.

**How to apply:** Utiliser l’association propriétaire administrateur des profils et des classes pour chaque nouvelle route de gestion; les mots de passe restent exclusivement gérés par Clerk.