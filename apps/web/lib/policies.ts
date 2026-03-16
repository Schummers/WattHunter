export const POLICY_TYPES = [
  {
    slug: "specialist",
    icon: "Target",
    name: "Speciality",
    description: "Boost riders matching a specific specialty.",
    unlockLevel: 1,
    paramKey: "specialty",
    options: ["GC", "Sprint", "TT", "One Day"],
  },
  {
    slug: "national_pride",
    icon: "Globe",
    name: "Nationality",
    description: "Boost riders from a specific country.",
    unlockLevel: 3,
    paramKey: "nationality",
    options: null, // dynamic from DB
  },
  {
    slug: "team_chemistry",
    icon: "Users",
    name: "Teams",
    description: "Boost riders belonging to a specific pro team.",
    unlockLevel: 5,
    paramKey: "team",
    options: null, // dynamic from DB
  },
  {
    slug: "young_blood",
    icon: "Clock",
    name: "Age",
    description: "Boost riders within a specific age range.",
    unlockLevel: 7,
    paramKey: "max_age",
    options: ["23", "25", "28"],
  },
] as const;

export type PolicyType = (typeof POLICY_TYPES)[number];

export function getMaxActivePolicies(level: number): number {
  return level >= 9 ? 3 : level >= 3 ? 2 : 1;
}

export function getPolicyBySlug(slug: string): PolicyType | undefined {
  return POLICY_TYPES.find((p) => p.slug === slug);
}
