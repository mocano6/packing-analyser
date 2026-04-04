/** Zespół widoczny w selektorach i listach — brak inactive lub inactive !== true */
export function isTeamActive(team: { inactive?: boolean } | null | undefined): boolean {
  return team != null && team.inactive !== true;
}
