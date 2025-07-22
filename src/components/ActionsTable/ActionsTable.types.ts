// src/components/ActionsTable/ActionsTable.types.ts
import { Action, Player } from "@/types";
import { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";

// Rozszerzony typ akcji używany w tabeli
export interface ActionsTableAction extends Action {
  // Używamy właściwych pól dla wartości xT
  xTValueStart?: number;  // Zastępuje senderClickValue
  xTValueEnd?: number;    // Zastępuje receiverClickValue
}

export interface ActionsTableProps {
  actions: Action[];
  players?: Player[];
  onActionClick?: (action: Action) => void;
  highlightedPlayerId?: string | null;
  onDeleteAction?: (actionId: string) => void;
  onEditAction?: (action: Action) => void;
  onRefreshPlayersData?: () => void;
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
}
