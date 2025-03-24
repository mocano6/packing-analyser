// src/components/ActionsTable/ActionsTable.types.ts
import { Action, Player } from "@/types";

export interface ActionsTableProps {
  actions: Action[];
  players?: Player[];
  onActionClick?: (action: Action) => void;
  highlightedPlayerId?: string | null;
  onDeleteAction?: (actionId: string) => void;
  onDeleteAllActions?: () => void;
}
