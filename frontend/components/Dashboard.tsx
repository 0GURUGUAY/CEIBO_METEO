'use client';

import { useEffect, useState } from 'react';
import {
  createLocation,
  deleteLocation,
  getAutomationStatus,
  getLatestForecast,
  getLocations,
  getProjectOverview,
  getReliabilityScores,
  searchLocations,
  updateLocationNotes,
  type AutomationStatus,
  type ForecastRun,
  type Location,
  type LocationSearchResult,
  type ProjectOverview,
  type ReliabilityScore,
} from '../lib/api';

type Language = 'fr' | 'es';

const localeByLanguage: Record<Language, string> = {
  fr: 'fr-FR',
  es: 'es-ES',
};

const SELECTED_LOCATION_STORAGE_KEY = 'wr-selected-location-id';

const translations = {
  fr: {
    title: 'CEIBO - Weather Reliability Lab',
    lead: 'Suivi des prévisions, des observations réelles et de la fiabilité météo pour les villes enregistrées.',
    loadError: 'Échec du chargement des données du projet',
    collectError: 'Échec du stockage des prévisions',
    searchMinLength: 'Saisis au moins 2 caractères pour rechercher une ville.',
    searchEmpty: 'Aucune ville correspondante trouvée.',
    searchError: 'Échec de la recherche de ville',
    addSuccess: (name: string) => `${name} a été ajoutée à la liste des villes analysées.`,
    addError: 'Échec de l’ajout de la ville',
    deleteConfirm: (name: string) => `Supprimer ${name} et toutes les données associées ?`,
    deleteSuccess: (name: string) => `${name} a été supprimée avec toutes les données associées.`,
    deleteError: 'Échec de la suppression de la ville',
    noForecastStored: 'Aucune prévision n\'a été stockée.',
    collectMessage: (count: number, name: string) => `${count} créneau(x) de prévision 3 h stocké(s) pour ${name}.`,
    citySection: 'Ville suivie',
    model: 'Modèle',
    reliabilitySummary: 'Fiabilité',
    reliabilityUnavailable: 'Pas assez de recul',
    derivedForecastTitle: 'Prévision CEIBO',
    derivedForecastLead: 'Projection corrigée à partir des biais observés sur les horizons courts.',
    derivedForecastMethod: 'Méthode: la prévision brute Open-Meteo est ajustée avec le biais historique mesuré sur chaque horizon.',
    correctedTemperature: 'Temp. corrigée',
    correctedPrecipitation: 'Pluie corrigée',
    correctedWind: 'Vent corrigé',
    correctedGusts: 'Rafales corrigées',
    forecastDirection: 'Direction',
    confidence: 'Confiance',
    noDerivedForecast: 'Pas assez de données pour calculer une prévision CEIBO sur H+3, H+12 et H+24.',
    wind: 'Vent',
    gusts: 'Rafales',
    direction: 'Direction',
    cityTabsLabel: 'Gestion des villes',
    citiesTab: 'Villes',
    addCityTab: 'Ajouter une ville',
    citiesTracked: 'Villes analysées',
    noCities: 'Aucune ville enregistrée pour le moment.',
    addCityLabel: 'Ajouter une ville',
    addCityPlaceholder: 'Exemple : Barcelona',
    searching: 'Recherche...',
    search: 'Rechercher',
    adding: 'Ajout...',
    add: 'Ajouter',
    deleteSelectedCity: 'Supprimer la ville sélectionnée',
    deleting: 'Suppression...',
    storeForecasts: 'Stocker les prévisions toutes les 3 heures',
    storing: 'Stockage en cours...',
    reliabilityTitle: 'Indicateur de fiabilité',
    reliabilityQuickRead: 'Lecture rapide:',
    reliabilityGood: 'bon',
    reliabilityMedium: 'moyen',
    reliabilityLow: 'faible',
    reliabilityGoodRange: 'au-dessus de 90 %',
    reliabilityMediumRange: 'entre 75 % et 90 %',
    reliabilityLowRange: 'en dessous de 75 %',
    signedBiasIntro: 'Biais signé:',
    signedBiasText: 'une valeur positive signifie que la prévision a eu tendance à surestimer, une valeur négative qu’elle a sous-estimé.',
    horizon: 'Horizon',
    score: 'Score',
    samples: 'Échantillons',
    tempError: 'Erreur temp.',
    tempBias: 'Biais temp.',
    rainError: 'Erreur pluie',
    rainBias: 'Biais pluie',
    windError: 'Erreur vent',
    windBias: 'Biais vent',
    gustError: 'Erreur rafales',
    gustBias: 'Biais rafales',
    noReliability: 'Aucun score de fiabilité disponible pour cette ville pour le moment.',
    weatherTitle: 'Données météo',
    cityShown: 'Ville affichée',
    issuedOn: 'Émise le',
    slot: 'Créneau',
    temperature: 'Température',
    feelsLike: 'Ressenti',
    precipitation: 'Précipitations',
    probability: 'Probabilité',
    humidity: 'Humidité',
    noStoredForecast: 'Aucune prévision stockée pour cette ville pour le moment.',
    backgroundTasks: 'Tâches de fond',
    backgroundTasksLead: 'Suivi automatique des villes enregistrées.',
    hide: 'Masquer',
    show: 'Afficher',
    autoCycleEvery: 'Cycle automatique toutes les',
    minutes: 'minutes',
    nextUpdateIn: 'Prochaine mise à jour automatique dans',
    localRefreshEvery: 'Mini-refresh des prévisions toutes les',
    reliabilityRecomputedFor: 'L’analyse de fiabilité est recalculée pour',
    citiesInDb: 'ville(s) actuellement enregistrée(s) en base.',
    observationsLookback: 'Observations',
    reliabilityLookback: 'Fiabilité',
    slidingDays: 'jours glissants',
    lastCycleFinished: 'Dernier cycle terminé',
    notExecutedYet: 'pas encore exécuté',
    modelExplanation1: 'Open-Meteo ne repose pas sur un seul modèle. Avec Best Match, le service combine automatiquement les modèles les plus adaptés à la zone pour produire la meilleure prévision disponible.',
    modelExplanation2: 'Pour la France, l’Espagne et la Méditerranée, cela mobilise surtout des familles comme AROME / ARPEGE de Météo-France, ICON de DWD et IFS / AIFS d’ECMWF.',
    modelExplanation3: 'La fréquence de mise à jour dépend du modèle utilisé: souvent 1 heure, 3 heures ou 6 heures selon la zone et la source retenue.',
    lastMessage: 'Dernier message',
    noRunYet: 'Aucune exécution pour le moment.',
    nextRun: 'Prochain passage',
    toSchedule: 'à planifier',
    cityNotesLabel: 'Notes sur la ville',
    cityNotesPlaceholder: 'Exemples : spot abrité, vent thermique fréquent, contraintes locales, remarques personnelles...',
    saveNotes: 'Enregistrer les notes',
    savingNotes: 'Enregistrement...',
    notesSaved: 'Notes enregistrées.',
    notesSaveError: 'Échec de l’enregistrement des notes.',
    refreshTickerLabel: 'Mini-refresh local',
    refreshTickerUpdated: 'Dernière maj',
    refreshTickerNext: 'Prochain passage',
    refreshTickerStatus: 'Statut',
    refreshTickerNever: 'pas encore',
    refreshTickerPending: 'en attente',
    liveLogTitle: 'Moniteur de logs',
    liveLogLead: 'Journal synthétique du scheduler et des tâches de fond.',
    liveLogEmpty: 'En attente des premiers événements...',
    terminalPrompt: 'ceibo-meteo@automation',
    languageLabel: 'Langue',
    french: 'Français',
    spanish: 'Español',
    weatherNow: 'Conditions en cours',
    clearSky: 'Ciel dégagé',
    variableSky: 'Ciel variable',
    mist: 'Brume',
    rain: 'Pluie',
    snow: 'Neige',
    storm: 'Orage',
    cloudy: 'Nuageux',
    idle: 'En attente',
    running: 'En cours',
    succeeded: 'OK',
    failed: 'Erreur',
    interruptionWarning: (delayedMinutes: number, missedCycles: number) => `Interruption détectée: le cycle a redémarré avec ${delayedMinutes} minute(s) de retard. ${missedCycles} cycle(s) ont potentiellement été manqués, donc certains runs de prévision peuvent manquer.`,
    forecastRefresh: 'Mini-refresh des prévisions',
    forecastCollection: 'Collecte des prévisions',
    observationCollection: 'Collecte des observations',
    reliabilityCalculation: 'Calcul de fiabilité',
  },
  es: {
    title: 'CEIBO - Laboratorio de Fiabilidad Meteorológica',
    lead: 'Seguimiento de previsiones, observaciones reales y fiabilidad meteorológica para las ciudades registradas.',
    loadError: 'Error al cargar los datos del proyecto',
    collectError: 'Error al guardar las previsiones',
    searchMinLength: 'Introduce al menos 2 caracteres para buscar una ciudad.',
    searchEmpty: 'No se ha encontrado ninguna ciudad.',
    searchError: 'Error en la búsqueda de la ciudad',
    addSuccess: (name: string) => `${name} se ha añadido a la lista de ciudades analizadas.`,
    addError: 'Error al añadir la ciudad',
    deleteConfirm: (name: string) => `¿Eliminar ${name} y todos los datos asociados?`,
    deleteSuccess: (name: string) => `${name} se ha eliminado con todos los datos asociados.`,
    deleteError: 'Error al eliminar la ciudad',
    noForecastStored: 'No se ha guardado ninguna previsión.',
    collectMessage: (count: number, name: string) => `${count} franja(s) de previsión de 3 h guardada(s) para ${name}.`,
    citySection: 'Ciudad seguida',
    model: 'Modelo',
    reliabilitySummary: 'Fiabilidad',
    reliabilityUnavailable: 'Sin suficiente histórico',
    derivedForecastTitle: 'Previsión CEIBO',
    derivedForecastLead: 'Proyección corregida a partir de los sesgos observados en los horizontes cortos.',
    derivedForecastMethod: 'Método: la previsión bruta de Open-Meteo se ajusta con el sesgo histórico medido para cada horizonte.',
    correctedTemperature: 'Temp. corregida',
    correctedPrecipitation: 'Lluvia corregida',
    correctedWind: 'Viento corregido',
    correctedGusts: 'Rachas corregidas',
    forecastDirection: 'Dirección',
    confidence: 'Confianza',
    noDerivedForecast: 'No hay suficientes datos para calcular una previsión CEIBO en H+3, H+12 y H+24.',
    wind: 'Viento',
    gusts: 'Rachas',
    direction: 'Dirección',
    cityTabsLabel: 'Gestión de ciudades',
    citiesTab: 'Ciudades',
    addCityTab: 'Añadir una ciudad',
    citiesTracked: 'Ciudades analizadas',
    noCities: 'No hay ciudades registradas por ahora.',
    addCityLabel: 'Añadir una ciudad',
    addCityPlaceholder: 'Ejemplo: Barcelona',
    searching: 'Buscando...',
    search: 'Buscar',
    adding: 'Añadiendo...',
    add: 'Añadir',
    deleteSelectedCity: 'Eliminar la ciudad seleccionada',
    deleting: 'Eliminando...',
    storeForecasts: 'Guardar previsiones cada 3 horas',
    storing: 'Guardando...',
    reliabilityTitle: 'Indicador de fiabilidad',
    reliabilityQuickRead: 'Lectura rápida:',
    reliabilityGood: 'bueno',
    reliabilityMedium: 'medio',
    reliabilityLow: 'bajo',
    reliabilityGoodRange: 'por encima del 90 %',
    reliabilityMediumRange: 'entre el 75 % y el 90 %',
    reliabilityLowRange: 'por debajo del 75 %',
    signedBiasIntro: 'Sesgo firmado:',
    signedBiasText: 'un valor positivo significa que la previsión tendió a sobreestimar, un valor negativo que tendió a subestimar.',
    horizon: 'Horizonte',
    score: 'Puntuación',
    samples: 'Muestras',
    tempError: 'Error temp.',
    tempBias: 'Sesgo temp.',
    rainError: 'Error lluvia',
    rainBias: 'Sesgo lluvia',
    windError: 'Error viento',
    windBias: 'Sesgo viento',
    gustError: 'Error rachas',
    gustBias: 'Sesgo rachas',
    noReliability: 'Todavía no hay puntuaciones de fiabilidad para esta ciudad.',
    weatherTitle: 'Datos meteorológicos',
    cityShown: 'Ciudad mostrada',
    issuedOn: 'Emitida el',
    slot: 'Franja',
    temperature: 'Temperatura',
    feelsLike: 'Sensación',
    precipitation: 'Precipitaciones',
    probability: 'Probabilidad',
    humidity: 'Humedad',
    noStoredForecast: 'Todavía no hay previsiones guardadas para esta ciudad.',
    backgroundTasks: 'Tareas en segundo plano',
    backgroundTasksLead: 'Seguimiento automático de las ciudades registradas.',
    hide: 'Ocultar',
    show: 'Mostrar',
    autoCycleEvery: 'Ciclo automático cada',
    minutes: 'minutos',
    nextUpdateIn: 'Próxima actualización automática dentro de',
    localRefreshEvery: 'Mini-refresh de previsiones cada',
    reliabilityRecomputedFor: 'El análisis de fiabilidad se recalcula para',
    citiesInDb: 'ciudad(es) registradas actualmente en la base de datos.',
    observationsLookback: 'Observaciones',
    reliabilityLookback: 'Fiabilidad',
    slidingDays: 'días deslizantes',
    lastCycleFinished: 'Último ciclo terminado',
    notExecutedYet: 'aún no ejecutado',
    modelExplanation1: 'Open-Meteo no se basa en un único modelo. Con Best Match, el servicio combina automáticamente los modelos más adecuados para la zona y produce la mejor previsión disponible.',
    modelExplanation2: 'Para Francia, España y el Mediterráneo, esto moviliza sobre todo familias como AROME / ARPEGE de Météo-France, ICON de DWD e IFS / AIFS de ECMWF.',
    modelExplanation3: 'La frecuencia de actualización depende del modelo utilizado: normalmente 1 hora, 3 horas o 6 horas según la zona y la fuente seleccionada.',
    lastMessage: 'Último mensaje',
    noRunYet: 'Todavía no hay ninguna ejecución.',
    nextRun: 'Próximo paso',
    toSchedule: 'por programar',
    cityNotesLabel: 'Notas sobre la ciudad',
    cityNotesPlaceholder: 'Ejemplos: spot protegido, viento térmico frecuente, restricciones locales, observaciones personales...',
    saveNotes: 'Guardar notas',
    savingNotes: 'Guardando...',
    notesSaved: 'Notas guardadas.',
    notesSaveError: 'Error al guardar las notas.',
    refreshTickerLabel: 'Mini-refresh local',
    refreshTickerUpdated: 'Última act.',
    refreshTickerNext: 'Próximo paso',
    refreshTickerStatus: 'Estado',
    refreshTickerNever: 'todavía no',
    refreshTickerPending: 'en espera',
    liveLogTitle: 'Monitor de logs',
    liveLogLead: 'Registro sintético del scheduler y de las tareas en segundo plano.',
    liveLogEmpty: 'Esperando los primeros eventos...',
    terminalPrompt: 'ceibo-meteo@automation',
    languageLabel: 'Idioma',
    french: 'Français',
    spanish: 'Español',
    weatherNow: 'Condiciones actuales',
    clearSky: 'Cielo despejado',
    variableSky: 'Cielo variable',
    mist: 'Bruma',
    rain: 'Lluvia',
    snow: 'Nieve',
    storm: 'Tormenta',
    cloudy: 'Nublado',
    idle: 'En espera',
    running: 'En curso',
    succeeded: 'OK',
    failed: 'Error',
    interruptionWarning: (delayedMinutes: number, missedCycles: number) => `Interrupción detectada: el ciclo se reinició con ${delayedMinutes} minuto(s) de retraso. Es posible que se hayan perdido ${missedCycles} ciclo(s), por lo que podrían faltar algunas ejecuciones de previsión.`,
    forecastRefresh: 'Mini-refresh de previsiones',
    forecastCollection: 'Recogida de previsiones',
    observationCollection: 'Recogida de observaciones',
    reliabilityCalculation: 'Cálculo de fiabilidad',
  },
} as const;

export function Dashboard() {
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [language, setLanguage] = useState<Language>('fr');
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isAutomationPanelOpen, setIsAutomationPanelOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const savedSelectedLocationId = Number(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY));
    return Number.isInteger(savedSelectedLocationId) ? savedSelectedLocationId : null;
  });
  const [activeCityTab, setActiveCityTab] = useState<'list' | 'add'>('list');
  const [latestForecast, setLatestForecast] = useState<ForecastRun | null>(null);
  const [reliabilityScores, setReliabilityScores] = useState<ReliabilityScore[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  const [locationNotesDraft, setLocationNotesDraft] = useState('');
  const [isSavingLocationNotes, setIsSavingLocationNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = translations[language];
  const locale = localeByLanguage[language];

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('wr-language');
    if (savedLanguage === 'fr' || savedLanguage === 'es') {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('wr-language', language);
  }, [language]);

  useEffect(() => {
    if (selectedLocationId === null) {
      window.localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_LOCATION_STORAGE_KEY, String(selectedLocationId));
  }, [selectedLocationId]);

  useEffect(() => {
    async function load() {
      try {
        const [projectOverview, automation, bootstrapLocations] = await Promise.all([
          getProjectOverview(),
          getAutomationStatus(),
          getLocations(),
        ]);
        setOverview(projectOverview);
        setAutomationStatus(automation);
        setLocations(bootstrapLocations);

        const savedSelectedLocationId = Number(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY));
        const hasSavedSelection = Number.isInteger(savedSelectedLocationId);
        const restoredLocationId = hasSavedSelection
          ? bootstrapLocations.find((location) => location.id === savedSelectedLocationId)?.id ?? null
          : null;

        setSelectedLocationId(restoredLocationId ?? bootstrapLocations[0]?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadError);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshAutomationStatus();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    async function loadLatestForecast() {
      if (!selectedLocationId) {
        setLatestForecast(null);
        setReliabilityScores([]);
        return;
      }

      try {
        const [forecast, scores] = await Promise.all([
          getLatestForecast(selectedLocationId),
          getReliabilityScores(selectedLocationId),
        ]);
        setLatestForecast(forecast);
        setReliabilityScores(scores);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load latest forecast';

        if (message === 'No stored forecast found for this location') {
          setLatestForecast(null);
          setError(null);
          try {
            setReliabilityScores(await getReliabilityScores(selectedLocationId));
          } catch {
            setReliabilityScores([]);
          }
          return;
        }

        setError(message);
      }
    }

    void loadLatestForecast();
  }, [selectedLocationId]);

  async function handleSearchLocations(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuery = cityQuery.trim();
    if (normalizedQuery.length < 2) {
      setError(t.searchMinLength);
      return;
    }

    setIsSearching(true);
    setError(null);
    setStatusMessage(null);

    try {
      const results = await searchLocations(normalizedQuery);
      setSearchResults(results);

      if (results.length === 0) {
        setStatusMessage(t.searchEmpty);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : t.searchError);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddLocation(searchResult: LocationSearchResult) {
    setIsAddingLocation(true);
    setError(null);
    setStatusMessage(null);

    try {
      const location = await createLocation(searchResult);
      const updatedLocations = await getLocations();
      setLocations(updatedLocations);
      setSelectedLocationId(location.id);
      setActiveCityTab('list');
      setCityQuery('');
      setSearchResults([]);
      await refreshAutomationStatus();
      setStatusMessage(t.addSuccess(location.name));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : t.addError);
    } finally {
      setIsAddingLocation(false);
    }
  }

  async function refreshLatestForecast(locationId: number) {
    const [forecast, scores] = await Promise.all([
      getLatestForecast(locationId),
      getReliabilityScores(locationId),
    ]);
    setLatestForecast(forecast);
    setReliabilityScores(scores);
  }

  async function refreshAutomationStatus() {
    setAutomationStatus(await getAutomationStatus());
  }

  async function handleDeleteLocation() {
    if (!selectedLocation) {
      return;
    }

    const confirmed = window.confirm(t.deleteConfirm(selectedLocation.name));
    if (!confirmed) {
      return;
    }

    setIsDeletingLocation(true);
    setError(null);
    setStatusMessage(null);

    try {
      await deleteLocation(selectedLocation.id);
      const updatedLocations = await getLocations();
      const nextLocationId = updatedLocations[0]?.id ?? null;
      setLocations(updatedLocations);
      setSelectedLocationId(nextLocationId);
      setLatestForecast(null);
      setReliabilityScores([]);
      await refreshAutomationStatus();
      setStatusMessage(t.deleteSuccess(selectedLocation.name));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t.deleteError);
    } finally {
      setIsDeletingLocation(false);
    }
  }

  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const hasLocationNotesChanges = (selectedLocation?.notes ?? '') !== locationNotesDraft;
  const nextAutomationRunAt = getNextAutomationRunAt(automationStatus);
  const nextAutomationCountdown = formatCountdown(nextAutomationRunAt, currentTime, language);
  const forecastRefreshJob = automationStatus?.jobs.find((job) => job.name === 'forecastRefresh') ?? null;
  const weatherPreview = getWeatherPreview(latestForecast, currentTime, language);
  const interruptionWarningMessage = getInterruptionWarningMessage(automationStatus, language);
  const reliabilitySummaryScore = getReliabilitySummaryScore(reliabilityScores);
  const derivedForecasts = getDerivedForecasts(latestForecast, reliabilityScores, [3, 12, 24]);

  useEffect(() => {
    setLocationNotesDraft(selectedLocation?.notes ?? '');
  }, [selectedLocation?.id, selectedLocation?.notes]);

  async function handleSaveLocationNotes() {
    if (!selectedLocation || !hasLocationNotesChanges) {
      return;
    }

    setIsSavingLocationNotes(true);
    setError(null);
    setStatusMessage(null);

    try {
      const updatedLocation = await updateLocationNotes(selectedLocation.id, locationNotesDraft.trim() || null);
      setLocations((currentLocations) => currentLocations.map((location) => (
        location.id === updatedLocation.id ? updatedLocation : location
      )));
      setStatusMessage(t.notesSaved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.notesSaveError);
    } finally {
      setIsSavingLocationNotes(false);
    }
  }

  return (
    <main className="shell">
      <section className="pageHeader">
        <h1 className="pageTitle">{t.title}</h1>
        <p className="lead">{t.lead}</p>
        <div className="marketTicker" aria-label={t.refreshTickerLabel}>
          <div className="marketTickerTrack">
            <span className="tickerPill accent">{t.refreshTickerLabel}</span>
            <span className="tickerItem">
              <strong>{t.refreshTickerStatus}</strong>
              <span>{forecastRefreshJob ? formatJobStatus(forecastRefreshJob.status, language) : t.refreshTickerPending}</span>
            </span>
            <span className="tickerItem">
              <strong>{t.refreshTickerUpdated}</strong>
              <span>{formatRefreshTimestamp(forecastRefreshJob?.lastSucceededAt ?? null, locale, t.refreshTickerNever)}</span>
            </span>
            <span className="tickerItem">
              <strong>{t.refreshTickerNext}</strong>
              <span>{formatRefreshCountdown(forecastRefreshJob?.nextRunAt ?? null, currentTime, language, t.refreshTickerPending)}</span>
            </span>
            <span className="tickerPill muted">{selectedLocation?.name ?? '---'}</span>
            <span className="tickerItem">
              <strong>{t.model}</strong>
              <span>{latestForecast?.providerModel ? formatProviderModel(latestForecast.providerModel) : 'Best Match'}</span>
            </span>
          </div>
        </div>
      </section>

      {error ? <p className="banner error">{error}</p> : null}
      {statusMessage ? <p className="banner success">{statusMessage}</p> : null}
      {interruptionWarningMessage ? (
        <p className="banner warning">{interruptionWarningMessage}</p>
      ) : null}

      <section className="card cityCard">
        {selectedLocation ? (
          <>
            <div className="cityHeader">
              <div>
                <p className="cityName">{selectedLocation.name}</p>
                <p className="locationMeta">
                  {selectedLocation.latitude}, {selectedLocation.longitude}
                </p>
                {latestForecast?.providerModel ? (
                  <p className="modelBadge">{t.model}: {formatProviderModel(latestForecast.providerModel)}</p>
                ) : null}
              </div>
              <div className="cityHeaderAside">
                <div className={`reliabilityHero ${reliabilitySummaryScore !== null ? getReliabilityScoreTone(reliabilitySummaryScore) : 'empty'}`}>
                  <span className="reliabilityHeroLabel">{t.reliabilitySummary}</span>
                  <strong className="reliabilityHeroValue">
                    {reliabilitySummaryScore !== null ? `${formatCompactNumber(reliabilitySummaryScore)}%` : '--'}
                  </strong>
                  <span className="reliabilityHeroMeta">
                    {reliabilitySummaryScore !== null ? getReliabilityLabel(reliabilitySummaryScore, t) : t.reliabilityUnavailable}
                  </span>
                </div>
                {weatherPreview ? (
                  <div className="weatherHero" aria-label={weatherPreview.label}>
                    <span className="weatherHeroIcon" aria-hidden="true">{weatherPreview.icon}</span>
                    <div className="weatherHeroContent">
                      <p className="weatherHeroLabel">{weatherPreview.label}</p>
                      <p className="weatherHeroMeta">
                        {formatNumber(weatherPreview.temperatureC, '°C')} • {weatherPreview.timeLabel}
                      </p>
                      <div className="weatherHeroStats">
                        <div className="weatherStat">
                          <span className="weatherStatLabel">{t.wind}</span>
                          <strong>{formatWindValue(weatherPreview.windSpeedKmh)}</strong>
                        </div>
                        <div className="weatherStat">
                          <span className="weatherStatLabel">{t.gusts}</span>
                          <strong>{formatWindValue(weatherPreview.windGustsKmh)}</strong>
                        </div>
                        <div className="weatherStat">
                          <span className="weatherStatLabel">{t.direction}</span>
                          <strong>{formatWindDirection(weatherPreview.windDirectionDeg, language)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="cityNotesPanel">
              <label className="fieldLabel" htmlFor="city-notes-textarea">
                {t.cityNotesLabel}
              </label>
              <textarea
                id="city-notes-textarea"
                value={locationNotesDraft}
                onChange={(event) => setLocationNotesDraft(event.target.value)}
                placeholder={t.cityNotesPlaceholder}
                rows={5}
              />
              <div className="cityNotesActions">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => void handleSaveLocationNotes()}
                  disabled={isSavingLocationNotes || !hasLocationNotesChanges}
                >
                  {isSavingLocationNotes ? t.savingNotes : t.saveNotes}
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="tabRow" role="tablist" aria-label={t.cityTabsLabel}>
          <button
            type="button"
            className={`tabButton ${activeCityTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveCityTab('list')}
            role="tab"
            aria-selected={activeCityTab === 'list'}
          >
            {t.citiesTab}
          </button>
          <button
            type="button"
            className={`tabButton ${activeCityTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveCityTab('add')}
            role="tab"
            aria-selected={activeCityTab === 'add'}
          >
            {t.addCityTab}
          </button>
        </div>

        {activeCityTab === 'list' ? (
          <div className="cityListPanel">
            <p className="fieldLabel">{t.citiesTracked}</p>
            {locations.length > 0 ? (
              <div className="cityButtonList">
                {locations.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    className={`cityButton ${location.id === selectedLocationId ? 'active' : ''}`}
                    onClick={() => setSelectedLocationId(location.id)}
                  >
                    {location.name}
                  </button>
                ))}
              </div>
            ) : (
              <p>{t.noCities}</p>
            )}
          </div>
        ) : (
          <>
            <form className="searchPanel" onSubmit={(event) => void handleSearchLocations(event)}>
              <label className="fieldLabel" htmlFor="city-search-input">
                {t.addCityLabel}
              </label>
              <div className="inlineActions">
                <input
                  id="city-search-input"
                  type="text"
                  value={cityQuery}
                  onChange={(event) => setCityQuery(event.target.value)}
                  placeholder={t.addCityPlaceholder}
                />
                <button type="submit" className="secondaryButton" disabled={isSearching || isAddingLocation}>
                  {isSearching ? t.searching : t.search}
                </button>
              </div>
            </form>

            {searchResults.length > 0 ? (
              <div className="searchResults">
                {searchResults.map((result) => (
                  <div key={`${result.displayName}-${result.latitude}-${result.longitude}`} className="searchResultItem">
                    <div>
                      <strong>{result.displayName}</strong>
                      <p className="locationMeta">
                        {result.latitude}, {result.longitude} {result.timezone ? `• ${result.timezone}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => void handleAddLocation(result)}
                      disabled={isAddingLocation || isSearching}
                    >
                      {isAddingLocation ? t.adding : t.add}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="inlineActions">
              <button
                type="button"
                className="dangerButton"
                onClick={() => void handleDeleteLocation()}
                disabled={!selectedLocationId || isDeletingLocation}
              >
                {isDeletingLocation ? t.deleting : t.deleteSelectedCity}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t.reliabilityTitle}</h2>

        <p className="locationMeta">
          {t.reliabilityQuickRead} <strong>{t.reliabilityGood}</strong> {t.reliabilityGoodRange}, <strong>{t.reliabilityMedium}</strong> {t.reliabilityMediumRange}, <strong>{t.reliabilityLow}</strong> {t.reliabilityLowRange}.
        </p>
        <p className="locationMeta">
          {t.signedBiasIntro} {t.signedBiasText}
        </p>

        {reliabilityScores.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t.horizon}</th>
                  <th>{t.score}</th>
                  <th>{t.samples}</th>
                  <th>{t.tempError}</th>
                  <th>{t.tempBias}</th>
                  <th>{t.rainError}</th>
                  <th>{t.rainBias}</th>
                  <th>{t.windError}</th>
                  <th>{t.windBias}</th>
                  <th>{t.gustError}</th>
                  <th>{t.gustBias}</th>
                </tr>
              </thead>
              <tbody>
                {reliabilityScores.map((score) => (
                  <tr key={score.id}>
                    <td>H+{score.horizonHours}</td>
                    <td>
                      <span className={`scoreBadge ${getReliabilityScoreTone(score.scorePct)}`}>
                        {formatNumber(score.scorePct, '%')}
                      </span>
                    </td>
                    <td>{score.sampleCount}</td>
                    <td>{formatNumber(score.temperatureMaeC, '°C')}</td>
                    <td>{formatSignedNumber(score.temperatureBiasC, '°C')}</td>
                    <td>{formatNumber(score.precipitationMaeMm, 'mm')}</td>
                    <td>{formatSignedNumber(score.precipitationBiasMm, 'mm')}</td>
                    <td>{formatNumber(score.windSpeedMaeKmh, 'km/h')}</td>
                    <td>{formatSignedNumber(score.windSpeedBiasKmh, 'km/h')}</td>
                    <td>{formatNumber(score.windGustsMaeKmh, 'km/h')}</td>
                    <td>{formatSignedNumber(score.windGustsBiasKmh, 'km/h')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t.noReliability}</p>
        )}
      </section>

      <section className="card">
        <h2>{t.derivedForecastTitle}</h2>
        <p className="locationMeta">{t.derivedForecastLead}</p>
        <p className="locationMeta">{t.derivedForecastMethod}</p>

        {derivedForecasts.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t.horizon}</th>
                  <th>{t.slot}</th>
                  <th>{t.correctedTemperature}</th>
                  <th>{t.correctedPrecipitation}</th>
                  <th>{t.correctedWind}</th>
                  <th>{t.correctedGusts}</th>
                  <th>{t.forecastDirection}</th>
                  <th>{t.confidence}</th>
                </tr>
              </thead>
              <tbody>
                {derivedForecasts.map((forecast) => (
                  <tr key={forecast.targetHorizonHours}>
                    <td>H+{forecast.targetHorizonHours}</td>
                    <td>{formatSlotDate(forecast.periodStartAt, locale)}</td>
                    <td>{formatNumber(forecast.temperatureC, '°C')}</td>
                    <td>{formatNumber(forecast.precipitationMm, 'mm')}</td>
                    <td>{formatNumber(forecast.windSpeedKmh, 'km/h')}</td>
                    <td>{formatNumber(forecast.windGustsKmh, 'km/h')}</td>
                    <td>{formatWindDirection(forecast.windDirectionDeg, language)}</td>
                    <td>
                      <span className={`scoreBadge ${getReliabilityScoreTone(forecast.scorePct)}`}>
                        {formatNumber(forecast.scorePct, '%')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t.noDerivedForecast}</p>
        )}
      </section>

      <section className="card">
        <h2>{t.weatherTitle}</h2>

        {latestForecast ? (
          <>
            <p>
              {t.cityShown} : <strong>{latestForecast.location.name}</strong>
            </p>
            <p>
              {t.issuedOn} <strong>{new Date(latestForecast.issuedAt).toLocaleString(locale)}</strong> via {latestForecast.provider}
            </p>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.horizon}</th>
                    <th>{t.slot}</th>
                    <th>{t.temperature}</th>
                    <th>{t.feelsLike}</th>
                    <th>{t.precipitation}</th>
                    <th>{t.probability}</th>
                    <th>{t.wind}</th>
                    <th>{t.gusts}</th>
                    <th>{t.direction}</th>
                    <th>{t.humidity}</th>
                  </tr>
                </thead>
                <tbody>
                  {latestForecast.periods.map((period) => (
                    <tr key={period.id}>
                      <td>H+{period.horizonHours}</td>
                      <td>{formatSlotDate(period.periodStartAt, locale)}</td>
                      <td>{formatNumber(period.temperatureC, '°C')}</td>
                      <td>{formatNumber(period.apparentTemperatureC, '°C')}</td>
                      <td>{formatNumber(period.precipitationMm, 'mm')}</td>
                      <td>{formatNumber(period.precipitationProbabilityPct, '%')}</td>
                      <td>{formatNumber(period.windSpeedKmh, 'km/h')}</td>
                      <td>{formatNumber(period.windGustsKmh, 'km/h')}</td>
                      <td>{formatWindDirection(period.windDirectionDeg, language)}</td>
                      <td>{formatNumber(period.relativeHumidityPct, '%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>{t.noStoredForecast}</p>
        )}
      </section>

      <section className="card topBanner">
        <div className="topBannerHeader">
          <div>
            <h2>{t.backgroundTasks}</h2>
            <p className="locationMeta">{t.backgroundTasksLead}</p>
          </div>
          <button
            type="button"
            className="panelToggle"
            onClick={() => setIsAutomationPanelOpen((currentValue) => !currentValue)}
            aria-expanded={isAutomationPanelOpen}
            aria-controls="automation-panel-content"
          >
            {isAutomationPanelOpen ? t.hide : t.show}
          </button>
        </div>
        {isAutomationPanelOpen ? (
          <div id="automation-panel-content" className="topBannerContent">
            <p>
              {t.autoCycleEvery} <strong>{automationStatus?.intervalMinutes ?? '...'}</strong> {t.minutes}.
            </p>
            <p className="locationMeta">
              {t.localRefreshEvery} <strong>{automationStatus?.forecastRefreshIntervalMinutes ?? '...'}</strong> {t.minutes}.
            </p>
            <p className="locationMeta">
              {t.nextUpdateIn} <strong>{nextAutomationCountdown}</strong>.
            </p>
            <p className="locationMeta">
              {t.reliabilityRecomputedFor} <strong>{locations.length}</strong> {t.citiesInDb}
            </p>
            <p className="locationMeta">
              {t.observationsLookback}: {automationStatus?.observationLookbackDays ?? '...'} {t.slidingDays}. {t.reliabilityLookback}: {automationStatus?.reliabilityLookbackDays ?? '...'} {t.slidingDays}.
            </p>
            <p className="locationMeta">
              {t.lastCycleFinished}: {automationStatus?.lastCycleFinishedAt ? new Date(automationStatus.lastCycleFinishedAt).toLocaleString(locale) : t.notExecutedYet}
            </p>

            <div className="modelExplanation">
              <p>{t.modelExplanation1}</p>
              <p className="locationMeta">{t.modelExplanation2}</p>
              <p className="locationMeta">{t.modelExplanation3}</p>
            </div>

            <div className="jobList">
              {(automationStatus?.jobs ?? []).map((job) => (
                <div key={job.name} className="jobItem">
                  <div>
                    <strong>{formatJobLabel(job.name, language)}</strong>
                    <p className="locationMeta">
                      {t.lastMessage}: {job.lastMessage ?? t.noRunYet}
                    </p>
                  </div>
                  <div className={`jobBadge ${job.status}`}>
                    {formatJobStatus(job.status, language)}
                  </div>
                  <p className="locationMeta">
                    {t.nextRun}: {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString(locale) : t.toSchedule}
                  </p>
                </div>
              ))}
            </div>

            <div className="logMonitorCard">
              <div>
                <strong>{t.liveLogTitle}</strong>
                <p className="locationMeta">{t.liveLogLead}</p>
              </div>
              <div className="terminalMonitor" role="log" aria-live="polite" aria-label={t.liveLogTitle}>
                {(automationStatus?.logs ?? []).length > 0 ? (
                  (automationStatus?.logs ?? []).map((entry) => (
                    <div key={`${entry.timestamp}-${entry.scope}-${entry.message}`} className={`terminalLine ${entry.level}`}>
                      <span className="terminalPrompt">{t.terminalPrompt}</span>
                      <span className="terminalTimestamp">[{formatTerminalTimestamp(entry.timestamp, locale)}]</span>
                      <span className={`terminalScope ${entry.level}`}>{formatJobLabel(entry.scope, language)}</span>
                      <span className="terminalMessage">{entry.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="terminalLine idle">
                    <span className="terminalPrompt">{t.terminalPrompt}</span>
                    <span className="terminalMessage">{t.liveLogEmpty}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="languageFooter">
        <label className="languageSwitcher" htmlFor="language-select">
          <span className="fieldLabel">{t.languageLabel}</span>
          <select id="language-select" className="languageSelect" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="fr">{t.french}</option>
            <option value="es">{t.spanish}</option>
          </select>
        </label>
      </div>
    </main>
  );
}

function formatNumber(value: number | null, unit: string) {
  if (value === null) {
    return '-';
  }

  return `${Math.round(value * 10) / 10} ${unit}`;
}

function formatSignedNumber(value: number | null, unit: string) {
  if (value === null) {
    return '-';
  }

  const roundedValue = Math.round(value * 10) / 10;
  const sign = roundedValue > 0 ? '+' : '';

  return `${sign}${roundedValue} ${unit}`;
}

function formatCompactNumber(value: number) {
  return `${Math.round(value * 10) / 10}`;
}

function formatJobStatus(status: 'idle' | 'running' | 'succeeded' | 'failed', language: Language) {
  const t = translations[language];

  switch (status) {
    case 'idle':
      return t.idle;
    case 'running':
      return t.running;
    case 'succeeded':
      return t.succeeded;
    case 'failed':
      return t.failed;
    default:
      return status;
  }
}

function formatTerminalTimestamp(timestamp: string, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getReliabilityScoreTone(score: number) {
  if (score >= 90) {
    return 'good';
  }

  if (score >= 75) {
    return 'medium';
  }

  return 'low';
}

function getReliabilitySummaryScore(scores: ReliabilityScore[]) {
  const shortTermScores = scores.filter((score) => score.horizonHours >= 3 && score.horizonHours <= 24);

  if (shortTermScores.length === 0) {
    return null;
  }

  const total = shortTermScores.reduce((sum, score) => sum + score.scorePct, 0);
  return Math.round((total / shortTermScores.length) * 10) / 10;
}

function getReliabilityLabel(
  score: number,
  t: Pick<(typeof translations)[Language], 'reliabilityGood' | 'reliabilityMedium' | 'reliabilityLow'>,
) {
  if (score >= 90) {
    return t.reliabilityGood;
  }

  if (score >= 75) {
    return t.reliabilityMedium;
  }

  return t.reliabilityLow;
}

function getDerivedForecasts(forecast: ForecastRun | null, scores: ReliabilityScore[], targetHorizons: number[]) {
  if (!forecast || forecast.periods.length === 0 || scores.length === 0) {
    return [];
  }

  return targetHorizons
    .map((targetHorizonHours) => {
      const period = findClosestPeriod(forecast, targetHorizonHours);
      const score = findClosestReliabilityScore(scores, targetHorizonHours);

      if (!period || !score) {
        return null;
      }

      return {
        targetHorizonHours,
        periodStartAt: period.periodStartAt,
        temperatureC: applyBias(period.temperatureC, score.temperatureBiasC),
        precipitationMm: applyBias(period.precipitationMm, score.precipitationBiasMm, { min: 0 }),
        windSpeedKmh: applyBias(period.windSpeedKmh, score.windSpeedBiasKmh, { min: 0 }),
        windGustsKmh: applyBias(period.windGustsKmh, score.windGustsBiasKmh, { min: 0 }),
        windDirectionDeg: period.windDirectionDeg,
        scorePct: score.scorePct,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
}

function findClosestPeriod(forecast: ForecastRun, targetHorizonHours: number) {
  return forecast.periods.reduce((closest, period) => {
    if (!closest) {
      return period;
    }

    const candidateDistance = Math.abs(period.horizonHours - targetHorizonHours);
    const currentDistance = Math.abs(closest.horizonHours - targetHorizonHours);

    return candidateDistance < currentDistance ? period : closest;
  }, null as ForecastRun['periods'][number] | null);
}

function findClosestReliabilityScore(scores: ReliabilityScore[], targetHorizonHours: number) {
  return scores.reduce((closest, score) => {
    if (!closest) {
      return score;
    }

    const candidateDistance = Math.abs(score.horizonHours - targetHorizonHours);
    const currentDistance = Math.abs(closest.horizonHours - targetHorizonHours);

    return candidateDistance < currentDistance ? score : closest;
  }, null as ReliabilityScore | null);
}

function applyBias(value: number | null, bias: number | null, options?: { min?: number }) {
  if (value === null) {
    return null;
  }

  const corrected = value - (bias ?? 0);
  if (options?.min !== undefined) {
    return Math.max(options.min, Math.round(corrected * 10) / 10);
  }

  return Math.round(corrected * 10) / 10;
}

function getNextAutomationRunAt(automationStatus: AutomationStatus | null) {
  const nextRunTimestamps = (automationStatus?.jobs ?? [])
    .map((job) => job.nextRunAt)
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (nextRunTimestamps.length === 0) {
    return null;
  }

  return Math.min(...nextRunTimestamps);
}

function formatCountdown(nextRunAt: number | null, currentTime: number, language: Language) {
  const t = translations[language];

  if (nextRunAt === null) {
    return t.toSchedule;
  }

  const remainingMs = Math.max(0, nextRunAt - currentTime);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} s`;
  }

  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

function formatRefreshCountdown(
  nextRunAt: string | null,
  currentTime: number,
  language: Language,
  fallback: string,
) {
  if (!nextRunAt) {
    return fallback;
  }

  return formatCountdown(new Date(nextRunAt).getTime(), currentTime, language);
}

function formatRefreshTimestamp(timestamp: string | null, locale: string, fallback: string) {
  if (!timestamp) {
    return fallback;
  }

  return new Date(timestamp).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeatherPreview(forecast: ForecastRun | null, currentTime: number, language: Language) {
  if (!forecast || forecast.periods.length === 0) {
    return null;
  }

  const locale = localeByLanguage[language];

  const currentPeriod = forecast.periods.reduce((closest, period) => {
    const periodTime = new Date(period.periodStartAt).getTime();
    const closestTime = new Date(closest.periodStartAt).getTime();

    return Math.abs(periodTime - currentTime) < Math.abs(closestTime - currentTime) ? period : closest;
  }, forecast.periods[0]);

  return {
    icon: getWeatherIcon(currentPeriod.weatherCode, currentPeriod.isDay),
    label: getWeatherLabel(currentPeriod.weatherCode, language),
    temperatureC: currentPeriod.temperatureC,
    windSpeedKmh: currentPeriod.windSpeedKmh,
    windGustsKmh: currentPeriod.windGustsKmh,
    windDirectionDeg: currentPeriod.windDirectionDeg,
    timeLabel: formatSlotDate(currentPeriod.periodStartAt, locale),
  };
}

function getWeatherIcon(weatherCode: number | null, isDay: boolean | null) {
  if (weatherCode === null) {
    return isDay === false ? '☾' : '○';
  }

  if ([0].includes(weatherCode)) {
    return isDay === false ? '☾' : '☀';
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return '⛅';
  }

  if ([45, 48].includes(weatherCode)) {
    return '〰';
  }

  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return '☔';
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return '❄';
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return '⛈';
  }

  return '☁';
}

function getWeatherLabel(weatherCode: number | null, language: Language) {
  const t = translations[language];

  if (weatherCode === null) {
    return t.weatherNow;
  }

  if (weatherCode === 0) {
    return t.clearSky;
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return t.variableSky;
  }

  if ([45, 48].includes(weatherCode)) {
    return t.mist;
  }

  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return t.rain;
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return t.snow;
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return t.storm;
  }

  return t.cloudy;
}

function formatProviderModel(providerModel: string) {
  if (providerModel === 'best_match') {
    return 'Best Match';
  }

  return providerModel
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatWindValue(valueKmh: number | null) {
  if (valueKmh === null) {
    return '-';
  }

  const knots = Math.round((valueKmh / 1.852) * 10) / 10;
  return `${Math.round(valueKmh)} km/h • ${knots} nd`;
}

function formatWindDirection(degrees: number | null, language: Language) {
  if (degrees === null) {
    return '-';
  }

  const directions = language === 'es' ? ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] : ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(degrees / 45) % directions.length;
  return `${directions[index]} (${degrees}°)`;
}

function formatSlotDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatJobLabel(
  jobName: AutomationStatus['jobs'][number]['name'] | AutomationStatus['logs'][number]['scope'],
  language: Language,
) {
  const t = translations[language];

  switch (jobName) {
    case 'scheduler':
      return 'Scheduler';
    case 'forecastRefresh':
      return t.forecastRefresh;
    case 'forecastCollection':
      return t.forecastCollection;
    case 'observationCollection':
      return t.observationCollection;
    case 'reliabilityCalculation':
      return t.reliabilityCalculation;
    default:
      return jobName;
  }
}

function getInterruptionWarningMessage(automationStatus: AutomationStatus | null, language: Language) {
  const warning = automationStatus?.interruptionWarning;
  if (!warning?.message || warning.delayedMinutes <= 0) {
    return null;
  }

  return translations[language].interruptionWarning(warning.delayedMinutes, warning.estimatedMissedCycles);
}
