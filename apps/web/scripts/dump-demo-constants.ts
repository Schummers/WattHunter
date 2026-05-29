import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS,
  DEMO_USER_IDS,
  DEMO_TEAM_NAMES,
  DEMO_VISITOR_TEAM_INDEX,
} from "@/lib/demo-constants";

const payload = {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS: [...DEMO_TEAM_IDS],
  DEMO_USER_IDS: [...DEMO_USER_IDS],
  DEMO_TEAM_NAMES: [...DEMO_TEAM_NAMES],
  DEMO_VISITOR_TEAM_INDEX,
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
