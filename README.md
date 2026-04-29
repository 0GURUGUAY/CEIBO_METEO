# Weather Reliability Lab

Application pour mesurer la solidite de previsions meteo sur une zone cible comme Barcelone.

## Documentation technique

Voir [docs/TECHNICAL.md](docs/TECHNICAL.md) pour l'architecture, les flux de donnees, les endpoints et l'exploitation du scheduler.

## Presentation simple

Voir [docs/PRESENTATION.md](docs/PRESENTATION.md) pour une version claire, non technique et partageable du projet.

## Objectif du MVP

- stocker des previsions a J+1, J+2, J+3, J+4 et J+5
- recuperer ensuite les observations reelles
- comparer prevision et realite
- produire un indicateur de confiance exploitable

## Stack de base

- Backend: Node.js + TypeScript + Express
- Frontend: Next.js
- Base de donnees: Postgres via Supabase
- ORM: Prisma

## Etat actuel

Cette reconstruction pose la base du projet:

- workspace npm avec scripts racine
- backend minimal avec API `health`, `project` et `locations`
- frontend minimal qui affiche la vision du projet
- schema Prisma initial pour locations, previsions et observations

## Commandes

```bash
npm install
npm run build
npm run dev
```

## Variables d'environnement

Voir `.env.example`.

## Etapes suivantes recommandees

1. brancher Prisma au backend
2. creer les migrations SQL
3. integrer un provider meteo pour collecter les previsions
4. integrer la collecte d'observations
5. calculer un score de fiabilite par horizon
