/**
 * Played before WattHunter, never opened an account, and never won anything:
 * no win, no podium, no jersey. They stay in the database — the archive is the
 * truth, and dropping rows would distort everyone else's starts — but no screen
 * shows them.
 *
 * JibsEPAULE is NOT in this list on purpose: he won the 2019 Tour de France and
 * two jerseys, so hiding him would leave nine wins listed for ten Tours played.
 */
export const HIDDEN_PLAYERS = new Set(["Fangio", "JoeDills"]);
