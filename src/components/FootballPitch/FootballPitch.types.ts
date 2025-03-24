// src/components/FootballPitch/FootballPitch.types.ts

export interface FootballPitchProps {
  selectedZone: number | null;
  onZoneSelect: (
    zoneIndex: number,
    xT?: number,
    clickValue1?: number,
    clickValue2?: number
  ) => void;
}

export interface ZoneCellProps {
  zoneIndex: number;
  xTValue: number;
  isSelected: boolean;
  isFirstSelection: boolean;
  isSecondSelection: boolean;
  onSelect: (zone: number) => void;
}
