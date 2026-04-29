# Weather Reliability Lab

## L'idee

Weather Reliability Lab est un projet simple a comprendre: il aide a savoir si une prevision meteo est vraiment digne de confiance.

Au lieu de seulement afficher la meteo du jour, l'application observe ce qui avait ete annonce, puis compare cette prevision avec ce qui s'est reellement passe.

Le but est de repondre a une question tres concrete:

**Peut-on faire confiance aux previsions meteo pour une ville donnee, a J+1, J+2, J+3, J+4 ou J+5 ?**

## A quoi ca sert

Quand on regarde la meteo, on aimerait savoir si la prevision est juste informative ou vraiment fiable.

Cette application permet de:

- suivre plusieurs villes
- conserver les previsions publiees pour les jours a venir
- recuperer ensuite la meteo reellement observee
- mesurer l'ecart entre ce qui etait annonce et ce qui s'est passe
- produire un indicateur de fiabilite facile a lire

En pratique, cela permet de voir si une ville est generalement bien previsible ou si les annonces deviennent vite incertaines apres quelques jours.

## Ce que l'application montre

L'application propose une lecture simple:

- les villes suivies
- les dernieres previsions stockees
- un historique compare entre prevision et realite
- un score de fiabilite selon l'horizon
- un suivi automatique des mises a jour en tache de fond

Autrement dit, ce n'est pas juste une application meteo. C'est un outil pour juger la qualite des previsions.

## Pourquoi c'est interessant

La plupart des services meteo donnent une prevision, mais peu expliquent a quel point elle est solide.

Weather Reliability Lab apporte cette couche de lecture supplementaire:

- savoir si la meteo de demain est generalement tres fiable
- voir a partir de quel horizon la confiance baisse
- comparer plusieurs villes entre elles
- mieux comprendre les limites reelles des previsions

Le projet peut interesser:

- les voyageurs
- les amateurs de plein air
- les personnes qui organisent des evenements
- les curieux qui veulent savoir si la meteo est vraiment previsible

## Un exemple tres simple

Imaginons que pour Barcelone, l'application enregistre chaque jour les previsions a J+1 jusqu'a J+5.

Quelques jours plus tard, elle regarde la meteo qui a vraiment eu lieu.

Si les temperatures, la pluie et le vent etaient proches de ce qui avait ete annonce, le score reste bon.
Si l'ecart est important, la confiance baisse.

On obtient alors une lecture plus honnete qu'une simple icone soleil ou nuage.

## La promesse du projet

Weather Reliability Lab veut transformer une prevision meteo en information utile pour la decision.

L'idee n'est pas seulement de dire:

**"voila le temps annonce"**

mais plutot:

**"voila a quel point cette prevision merite d'etre crue"**

## Etat actuel

Le projet permet deja de:

- ajouter ou supprimer des villes
- stocker des previsions meteo automatiquement
- collecter les observations reelles
- calculer un indicateur de fiabilite
- afficher le suivi dans une interface simple

## En une phrase

**Weather Reliability Lab est un tableau de bord qui mesure la fiabilite des previsions meteo ville par ville, pour aider a savoir non seulement ce qui est annonce, mais surtout ce qu'on peut vraiment croire.**