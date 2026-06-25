export interface GtStageEntry {
  number: number;
  date: string;
  name: string;
  isItt?: boolean;
}

export const GT_SCHEDULES: Record<string, GtStageEntry[]> = {
  "giro-d-italia/2026": [
    { number: 1, date: "2026-05-08", name: "Nessebar - Burgas" },
    { number: 2, date: "2026-05-09", name: "Burgas - Veliko Tarnovo" },
    { number: 3, date: "2026-05-10", name: "Plovdiv - Sofia" },
    { number: 4, date: "2026-05-12", name: "Catanzaro - Cosenza" },
    { number: 5, date: "2026-05-13", name: "Praia a Mare - Potenza" },
    { number: 6, date: "2026-05-14", name: "Paestum - Naples" },
    { number: 7, date: "2026-05-15", name: "Formia - Blockhaus" },
    { number: 8, date: "2026-05-16", name: "Chieti - Fermo" },
    { number: 9, date: "2026-05-17", name: "Cervia - Corno alle Scale" },
    { number: 10, date: "2026-05-19", name: "Viareggio - Massa", isItt: true },
    { number: 11, date: "2026-05-20", name: "Porcari - Chiavari" },
    { number: 12, date: "2026-05-21", name: "Imperia - Novi Ligure" },
    { number: 13, date: "2026-05-22", name: "Alessandria - Verbania" },
    { number: 14, date: "2026-05-23", name: "Aosta - Pila" },
    { number: 15, date: "2026-05-24", name: "Voghera - Milan" },
    { number: 16, date: "2026-05-26", name: "Bellinzona - Carì" },
    { number: 17, date: "2026-05-27", name: "Cassano d'Adda - Andalo" },
    { number: 18, date: "2026-05-28", name: "Fai della Paganella - Pieve di Soligo" },
    { number: 19, date: "2026-05-29", name: "Feltre - Alleghe" },
    { number: 20, date: "2026-05-30", name: "Gemona del Friuli - Piancavallo" },
    { number: 21, date: "2026-05-31", name: "Rome - Rome" },
  ],
  "tour-de-france/2026": [
    { number: 1, date: "2026-07-04", name: "Barcelona - Barcelona" },
    { number: 2, date: "2026-07-05", name: "Tarragona - Barcelona" },
    { number: 3, date: "2026-07-06", name: "Granollers - Les Angles" },
    { number: 4, date: "2026-07-07", name: "Carcassonne - Foix" },
    { number: 5, date: "2026-07-08", name: "Lannemezan - Pau" },
    { number: 6, date: "2026-07-09", name: "Pau - Gavarnie-Gèdre" },
    { number: 7, date: "2026-07-10", name: "Hagetmau - Bordeaux" },
    { number: 8, date: "2026-07-11", name: "Périgueux - Bergerac" },
    { number: 9, date: "2026-07-12", name: "Malemort - Ussel" },
    { number: 10, date: "2026-07-14", name: "Aurillac - Le Lioran" },
    { number: 11, date: "2026-07-15", name: "Vichy - Nevers" },
    { number: 12, date: "2026-07-16", name: "Circuit de Nevers Magny-Cours - Chalon-sur-Saône" },
    { number: 13, date: "2026-07-17", name: "Dole - Belfort" },
    { number: 14, date: "2026-07-18", name: "Mulhouse - Le Markstein" },
    { number: 15, date: "2026-07-19", name: "Champagnole - Plateau de Solaison" },
    { number: 16, date: "2026-07-21", name: "Évian Les-Bains - Thonon Les-Bains", isItt: true },
    { number: 17, date: "2026-07-22", name: "Chambéry - Voiron" },
    { number: 18, date: "2026-07-23", name: "Voiron - Orcières Merlette" },
    { number: 19, date: "2026-07-24", name: "Gap - Alpe d'Huez" },
    { number: 20, date: "2026-07-25", name: "Le Bourg d'Oisans - Alpe d'Huez" },
    { number: 21, date: "2026-07-26", name: "Thoiry - Paris" },
  ],
};

export const GT_REST_DAYS: Record<string, string[]> = {
  "giro-d-italia/2026": ["2026-05-11", "2026-05-18", "2026-05-25"],
  "tour-de-france/2026": ["2026-07-13", "2026-07-20"],
};

/**
 * GT Rescue : returns the moment the REPLACE window closes for a given GT.
 *
 * Rule (2026-05-21) : replace = end of 1st chronological rest day, Europe/Paris.
 * Refund stays available the whole GT — only replace is gated.
 *
 * The 2026 Giro has a special transfer rest day on 05-11 (3 rest days total).
 * Per user decision : on simplifie, the 1st rest day always counts.
 *
 * Returns null if no rest day data is configured for that GT.
 */
export function getReplaceWindowClosesAt(
  gtIdentifier: string,
  gtYear: number,
): Date | null {
  const key = `${gtIdentifier}/${gtYear}`;
  const restDays = GT_REST_DAYS[key];
  if (!restDays || restDays.length === 0) return null;
  // 1st rest day, end of day Europe/Paris (CEST = +02:00 ; all current GTs are
  // in summer so DST is constant ; revisit if a GT ever runs outside summer).
  return new Date(`${restDays[0]}T23:59:59+02:00`);
}
