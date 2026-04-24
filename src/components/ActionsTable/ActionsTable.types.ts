// src/components/ActionsTable/ActionsTable.types.ts
import { Action, Player } from "@/types";
import { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";
import { CustomVideoPlayerRef } from "@/components/CustomVideoPlayer/CustomVideoPlayer";

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
  youtubeVideoRef?: React.RefObject<YouTubeVideoRef>;
  customVideoRef?: React.RefObject<CustomVideoPlayerRef>;
  actionCategory?: "packing" | "regain" | "loses"; // Kategoria akcji
  /** Spójnie z trybem atak/obrona na boisku (analyzer) — unika „znikania” PxT po F5 przy rozjechanym filtrze tabeli. */
  packingListMode?: "attack" | "defense";
  onPackingListModeChange?: (mode: "attack" | "defense") => void;
}
