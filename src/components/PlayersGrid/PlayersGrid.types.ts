// src/components/PlayersGrid/PlayersGrid.types.ts
import { Player } from "@/types";

export interface PlayersGridProps {
  players: Player[];
  selectedPlayerId: string | null;
  onPlayerSelect: (id: string) => void;
  onAddPlayer: () => void;
  onEditPlayer: (id: string) => void;
  onDeletePlayer: (id: string) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export interface PlayerTileProps {
  player: Player;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}
