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
    // Rest day: 2026-05-11
    { number: 4, date: "2026-05-12", name: "Catanzaro - Cosenza" },
    { number: 5, date: "2026-05-13", name: "Praia a Mare - Potenza" },
    { number: 6, date: "2026-05-14", name: "Paestum - Naples" },
    { number: 7, date: "2026-05-15", name: "Formia - Blockhaus" },
    { number: 8, date: "2026-05-16", name: "Chieti - Fermo" },
    { number: 9, date: "2026-05-17", name: "Cervia - Corno alle Scale" },
    // Rest day: 2026-05-18
    { number: 10, date: "2026-05-19", name: "Viareggio - Massa", isItt: true },
    { number: 11, date: "2026-05-20", name: "Porcari - Chiavari" },
    { number: 12, date: "2026-05-21", name: "Imperia - Novi Ligure" },
    { number: 13, date: "2026-05-22", name: "Alessandria - Verbania" },
    { number: 14, date: "2026-05-23", name: "Aosta - Pila" },
    { number: 15, date: "2026-05-24", name: "Voghera - Milan" },
    // Rest day: 2026-05-25
    { number: 16, date: "2026-05-26", name: "Bellinzona - Carì" },
    { number: 17, date: "2026-05-27", name: "Cassano d'Adda - Andalo" },
    { number: 18, date: "2026-05-28", name: "Fai della Paganella - Pieve di Soligo" },
    { number: 19, date: "2026-05-29", name: "Feltre - Alleghe" },
    { number: 20, date: "2026-05-30", name: "Gemona del Friuli - Piancavallo" },
    { number: 21, date: "2026-05-31", name: "Rome - Rome" },
  ],
};
