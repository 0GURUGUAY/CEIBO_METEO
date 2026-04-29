export interface HorizonDefinition {
  label: string;
  daysAhead: number;
}

export interface ProjectOverview {
  title: string;
  description: string;
  zoneExample: string;
  objectives: string[];
  horizons: HorizonDefinition[];
  nextMilestones: string[];
}

const horizons: HorizonDefinition[] = [1, 2, 3, 4, 5].map((daysAhead) => ({
  label: `J+${daysAhead}`,
  daysAhead,
}));

export function getProjectOverview(): ProjectOverview {
  return {
    title: 'Weather Reliability Lab',
    description:
      'Mesurer la robustesse des prévisions météo de court terme en stockant chaque run puis en le comparant plus tard aux observations réelles.',
    zoneExample: 'Barcelona',
    objectives: [
      'Stocker les prévisions d une zone cible aux horizons J+1 à J+5.',
      'Collecter les observations réelles pour les mêmes dates.',
      'Calculer des indicateurs de confiance à partir de l écart entre prévision et réalité.',
    ],
    horizons,
    nextMilestones: [
      'Stocker les runs de prévision dans Postgres via Prisma.',
      'Collecter les observations réelles pour les mêmes dates.',
      'Ajouter un score de fiabilité par horizon et par ville.',
    ],
  };
}
