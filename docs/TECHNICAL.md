# Documentation Technique

## Vue d'ensemble

Weather Reliability Lab mesure la robustesse de previsions meteorologiques de court terme sur une ou plusieurs villes.

Le programme suit ce principe:

- stocker un run de prevision Open-Meteo pour une ville
- conserver les horizons journaliers J+1 a J+5 et les creaneaux horaires toutes les 3 heures
- stocker des observations reelles pour les memes villes
- comparer prevision et observation sur les memes horodatages
- calculer un score de fiabilite par horizon

## Architecture

Le projet est un monorepo npm avec deux workspaces.

- `backend`: API Express TypeScript, orchestration metier, acces Prisma
- `frontend`: interface Next.js App Router
- `prisma`: schema ORM de reference
- `supabase/migrations`: migrations SQL appliquees a Postgres/Supabase

## Backend

Le point d'entree est [backend/src/server.ts](backend/src/server.ts). Il demarre:

- l'application Express via [backend/src/app.ts](backend/src/app.ts)
- le scheduler applicatif via [backend/src/services/automationService.ts](backend/src/services/automationService.ts)

### Endpoints exposes

- `GET /api/health`: etat basique du backend
- `GET /api/project`: resume fonctionnel du projet
- `GET /api/automation/status`: etat du scheduler et des jobs de fond
- `GET /api/locations`: liste des villes suivies
- `GET /api/locations/search?query=...`: recherche de villes via l'API geocoding Open-Meteo
- `POST /api/locations`: ajout d'une ville a partir d'un resultat de recherche
- `DELETE /api/locations/:locationId`: suppression d'une ville et des donnees rattachees
- `GET /api/forecasts/:locationId/latest`: dernier run de prevision stocke pour une ville
- `POST /api/forecasts/collect`: collecte immediate des previsions pour une ville ou toutes les villes
- `GET /api/reliability/:locationId`: scores de fiabilite calcules pour une ville

### Services backend

#### Forecast service

[backend/src/services/forecastService.ts](backend/src/services/forecastService.ts) gere:

- la recherche geographique Open-Meteo
- l'ajout et la suppression de villes
- la collecte des previsions Open-Meteo
- la transformation des donnees horaires en pas de 3 heures
- le chargement du dernier run de prevision avec ses jours et ses periodes

Flux de collecte:

1. recuperer les villes a traiter
2. appeler `https://api.open-meteo.com/v1/forecast`
3. creer ou mettre a jour un `forecast_run`
4. remplacer les `forecast_days` du run
5. remplacer les `forecast_periods` du run

#### Observation service

[backend/src/services/observationService.ts](backend/src/services/observationService.ts) charge les observations reelles depuis l'API archive Open-Meteo.

Flux:

1. selection des villes
2. appel a `https://archive-api.open-meteo.com/v1/archive`
3. suppression de la fenetre d'observations deja en base pour la meme plage
4. insertion des observations horaires

#### Reliability service

[backend/src/services/reliabilityService.ts](backend/src/services/reliabilityService.ts) calcule les scores de fiabilite.

Principe:

- on rapproche `forecast_periods.period_start_at` et `observations.observed_at`
- on calcule une erreur absolue moyenne pour la temperature, la precipitation et le vent
- on transforme ces erreurs en score normalise entre 0 et 100

La formule actuelle est une composition ponderee:

- temperature: poids `0.5`
- precipitation: poids `0.3`
- vent: poids `0.2`

Cette formule est volontairement simple et peut etre remplacee plus tard par une formule metier plus adaptee.

#### Automation service

[backend/src/services/automationService.ts](backend/src/services/automationService.ts) orchestre trois jobs sequenciels:

1. collecte des previsions
2. collecte des observations
3. calcul de fiabilite

Le scheduler est process-local. Il vit dans le processus Node du backend.

Etat expose par l'API:

- statut de chaque job
- dernier debut et fin de cycle
- prochain passage prevu
- message du dernier run
- detection d'interruption si un cycle redemarre avec un retard anormal

## Frontend

Le frontend est construit avec Next.js App Router.

Fichiers principaux:

- [frontend/app/layout.tsx](frontend/app/layout.tsx): layout racine et import du CSS global
- [frontend/app/globals.css](frontend/app/globals.css): styles globaux
- [frontend/components/Dashboard.tsx](frontend/components/Dashboard.tsx): interface principale
- [frontend/lib/api.ts](frontend/lib/api.ts): client HTTP typé vers le backend

Le dashboard affiche:

- la vision produit
- la liste des villes suivies
- la recherche et l'ajout de ville
- la collecte manuelle des previsions
- la suppression d'une ville
- l'etat des taches de fond
- le dernier run de prevision
- les scores de fiabilite

## Modele de donnees

Le schema Prisma de reference est dans [prisma/schema.prisma](prisma/schema.prisma).

Tables principales:

- `locations`: villes suivies
- `forecast_runs`: un run de collecte de prevision par ville et par date d'emission
- `forecast_days`: resume journalier J+1 a J+5
- `forecast_periods`: detail horaire a pas de 3 heures
- `observations`: valeurs observees reelles
- `reliability_scores`: score par ville et par horizon

Les relations importantes utilisent `on delete cascade` pour qu'une suppression de ville nettoie automatiquement les donnees associees.

## Migrations SQL

Les migrations presentes dans `supabase/migrations` doivent rester coherentes avec Prisma.

Migrations structurantes du projet:

- `20260428190000_forecast_storage.sql`: tables de base locations, forecast_runs, forecast_days, observations
- `20260428194500_forecast_periods_3h.sql`: detail des previsions toutes les 3 heures
- `20260428213000_reliability_scores.sql`: persistance des scores de fiabilite

## Variables d'environnement

Le backend lit sa configuration via [backend/src/config/env.ts](backend/src/config/env.ts).

Variables utiles:

- `DATABASE_URL`: connexion Prisma principale
- `DIRECT_URL`: connexion directe Postgres pour Prisma
- `PORT`: port backend, par defaut `4000`
- `FRONTEND_URL`: origine CORS du frontend
- `NEXT_PUBLIC_API_BASE_URL`: base URL du backend pour le frontend
- `AUTOMATION_INTERVAL_MINUTES`: frequence du scheduler
- `OBSERVATION_LOOKBACK_DAYS`: profondeur de collecte des observations
- `RELIABILITY_LOOKBACK_DAYS`: profondeur du calcul de fiabilite

## Execution locale

Commandes principales:

```bash
npm install
npm run prisma:generate
npm run build
npm run dev
```

Pour controler les jobs sans se fier a l'interface:

```bash
curl -sS http://localhost:4000/api/automation/status
curl -sS http://localhost:4000/api/locations
curl -sS http://localhost:4000/api/forecasts/1/latest
curl -sS http://localhost:4000/api/reliability/1
```

## Limites connues

- le frontend en `next dev` peut corrompre `.next` et perdre temporairement ses assets CSS ou JS
- le scheduler est local au processus backend: si la machine dort ou si le backend s'arrete, les cycles ne tournent pas
- les previsions manquees pendant une interruption ne sont pas rattrapables retroactivement

## Exploitation sur Mac mini

Pour une execution continue:

- desactiver la veille systeme
- laisser le backend tourner en continu
- idealement passer en mode production locale plutot qu'en `next dev`
- utiliser `launchd` pour relancer automatiquement le backend au demarrage du Mac

## Extensions possibles

- ajouter un endpoint pour declencher manuellement un cycle complet de fond
- afficher la provenance des donnees reelles ou simulees dans l'interface
- raffiner la formule de fiabilite par variable et par jour
- historiser les scores dans le temps au lieu de n'en garder qu'un etat courant par horizon