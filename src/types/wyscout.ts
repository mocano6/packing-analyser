/** Typy Wyscout API v3 — tylko pola używane w LOOKBALL. */

export type WyscoutTeamCategory = "default" | "youth";
export type WyscoutTeamType = "club" | "national";
export type WyscoutGender = "male" | "female";
export type WyscoutMatchStatus = "Fixture" | "Played";
export type WyscoutSearchObjType = "competition" | "team" | "player" | "referee";

export interface WyscoutArea {
  alpha2code?: string;
  alpha3code?: string;
  id?: number;
  name?: string;
}

export interface WyscoutTeamRef {
  name: string;
  wyId: number;
}

export interface WyscoutTeam {
  wyId: number;
  name: string;
  officialName?: string;
  city?: string;
  gender?: WyscoutGender;
  category?: WyscoutTeamCategory;
  type?: WyscoutTeamType;
  imageDataURL?: string;
  area?: WyscoutArea;
  parent?: WyscoutTeamRef;
  children?: WyscoutTeamRef[];
}

export interface WyscoutSearchTeam extends WyscoutTeam {
  gsmId?: number;
}

export interface WyscoutCareerSeason {
  wyId?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  competitionId?: number;
}

export interface WyscoutCareerCompetition {
  wyId?: number;
  name?: string;
  format?: string;
  area?: WyscoutArea;
}

export interface WyscoutCareerEntry {
  competitionId?: number;
  seasonId?: number;
  teamId?: number;
  matchWon?: number;
  matchDraw?: number;
  matchLost?: number;
  matchTotal?: number;
  goalPro?: number;
  goalAgainst?: number;
  points?: number;
  rank?: number;
  groupName?: string;
  roundName?: string;
  competition?: WyscoutCareerCompetition;
  season?: WyscoutCareerSeason;
}

export interface WyscoutTeamCareer {
  career?: WyscoutCareerEntry[];
}

export interface WyscoutTeamMatch {
  matchId: number;
  competitionId?: number;
  seasonId?: number;
  roundId?: number;
  gameweek?: number;
  date?: string;
  dateutc?: string;
  label?: string;
  status?: WyscoutMatchStatus;
}

export interface WyscoutTeamMatches {
  matches?: WyscoutTeamMatch[];
  team?: WyscoutTeam;
}

export interface WyscoutSquadRole {
  code2?: string;
  code3?: string;
  name?: string;
}

export interface WyscoutSquadPlayer {
  wyId: number;
  shortName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  foot?: string;
  height?: number;
  status?: string;
  role?: WyscoutSquadRole;
}

export interface WyscoutTeamSquad {
  squad?: WyscoutSquadPlayer[];
}

export interface WyscoutMatchInfo {
  matchId?: number;
  label?: string;
  date?: string;
  dateutc?: string;
  gameweek?: number;
  competitionId?: number;
  seasonId?: number;
  duration?: string;
  teamsData?: Record<string, unknown>;
}

export interface WyscoutMatchAdvancedStats {
  match?: WyscoutMatchInfo;
  general?: Record<string, Record<string, unknown>>;
  defence?: Record<string, Record<string, unknown>>;
  duels?: Record<string, Record<string, unknown>>;
  flanks?: Record<string, Record<string, unknown>>;
  passes?: Record<string, Record<string, unknown>>;
  possession?: Record<string, Record<string, unknown>>;
  attacks?: Record<string, Record<string, unknown>>;
  transitions?: Record<string, Record<string, unknown>>;
  teams?: Record<string, WyscoutTeam>;
}

export interface WyscoutCompetition {
  wyId: number;
  name: string;
  format?: string;
  category?: string;
  gender?: WyscoutGender;
  type?: string;
  divisionLevel?: number;
  area?: WyscoutArea;
}

export interface WyscoutSeason {
  wyId: number;
  name: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  competitionId?: number;
}

export interface WyscoutTeamBinding {
  wyId: number;
  name: string;
  officialName?: string;
  competitionId?: number;
  competitionName?: string;
  seasonId?: number;
}

export interface WyscoutApiErrorBody {
  error?: {
    code?: number;
    message?: string;
  };
}
