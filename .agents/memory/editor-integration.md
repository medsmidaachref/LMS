---
name: Intégration des éditeurs
description: Décision durable sur l’intégration blocs/code des modules pédagogiques.
---

Les interfaces Vittascience hébergées sont les éditeurs principaux des activités; elles doivent être servies par le proxy interne de Master Class car l’origine officielle envoie `X-Frame-Options: SAMEORIGIN`. L’adaptateur local reste disponible uniquement pour la persistance. L’éditeur reste dans Master Class, sans lien d’ouverture dans un nouvel onglet. Ne pas intégrer les parcours ni les projets publics Vittascience.

**Why:** L’utilisateur veut directement les éditeurs blocs/code et les simulateurs décrits dans le dépôt `interfaces`, pas la consultation ou le chargement de projets Vittascience via `get_by_link`.

**Why:** Un iframe direct depuis le domaine Master Class est refusé par le navigateur à cause de `X-Frame-Options: SAMEORIGIN`; le proxy interne conserve l’affichage intégré sans contourner cette protection côté navigateur.

**Why:** Vittascience charge plusieurs centaines de ressources optionnelles; l’événement `load` complet de l’iframe peut rester en attente alors que Blockly et Ace sont déjà utilisables.

**Why:** Les chemins Vittascience ne peuvent pas être réécrits uniformément : une importation CSS `../../../interfaces` vise `openInterface/interfaces`, tandis que la même chaîne injectée par JavaScript vise le dossier racine `interfaces`. De plus, `_PATH` est concaténé à certains chemins et tout double préfixe casse les cartes et bibliothèques des simulateurs.

**How to apply:** Charger l’interface standalone correspondante via le proxy interne versionné, dans une iframe sans action d’ouverture externe. Le proxy doit rester limité aux interfaces connues, corriger les types MIME de GitHub Raw, mettre en cache les assets avec une limite mémoire, réécrire les chemins selon le type de ressource et rendre les concaténations avec `_PATH` idempotentes. Il doit rester public afin qu’une session Clerk expirée ne casse pas l’éditeur. L’état de chargement doit disparaître dès que Blockly ou Ace est détecté, avec un délai de secours; il ne doit pas attendre uniquement l’événement `load`. Ne pas demander de lien de projet et ne pas appeler les routes du contrôleur `project`.