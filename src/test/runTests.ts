// Minimalny runner testów bez frameworka.
// Testy są oparte o `assert` i uruchamiane przez ts-node.

import "../utils/matchDayLabels.test";
import "../types/staffPlanner.test";
import "../lib/staffPlannerFirestore.test";
import "../utils/pitchZones.test";
import "../components/Tabs/tabShortcuts.test";
import "../utils/timeFormat.test";
import "../utils/playerUtils.test";
import "../utils/playerMatching.test";
import "../utils/trendyKpis.test";
import "../utils/trendyKpiPlayerContributions.test";
import "../utils/correlationMatrixAxis.test";
import "../utils/correlationMatrixExport.test";
import "../utils/wiedzaWeightsMetrics.test";
import "../utils/matchXgSplits.test";
import "../lib/wiedzaAnalyzeCache.test";
import "../lib/wiedzaMatchCompact.test";
import "../utils/wiedzaBirthYearMinutes.test";
import "../utils/wiedzaZoneHeatmaps.test";
import "../utils/wiedzaRegainPostWindowByZone.test";
import "../utils/wiedzaRegainMapOverlay.test";
import "../utils/wiedzaShapeBuckets.test";
import "../utils/wiedzaPackingZoneFlow.test";
import "../utils/actionCategory.test";
import "../utils/externalVideoMatchInfo.test";
import "../utils/kpiDashboardPlayerShares.test";
import "../utils/userAllowedTeams.test";
import "../utils/filterMatchActionsByTeam.test";
import "../utils/filterActionsByTeamSquad.test";
import "../utils/firestoreTimestamps.test";
import "../utils/teamActive.test";
import "../utils/kpiRegainSequenceFlags.test";
import "../utils/kpiRegainLosesZoneRaw.test";
import "../utils/actionVideoSeekSeconds.test";
import "../utils/profileHeatmapVideoPanelLayout.test";
import "../components/FootballPitch/utils.test";
import "../lib/mergeMatchArrayById.test";
import "../lib/matchArrayFieldWrite.test";
import "../lib/findActionCollectionField.test";
import "../lib/normalizeActionFieldCountsForSave.test";
import "../lib/xg/torvaneySimple.test";
import "../lib/authorizationBearer.test";

