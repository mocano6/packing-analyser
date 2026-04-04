"use client";

import React from "react";
import styles from "./PitchHeader.module.css";
import { usePresentationMode } from "@/contexts/PresentationContext";

export interface PitchHeaderProps {
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  rightExtraContent?: React.ReactNode;
  matchInfo?: {
    team?: string;
    opponent?: string;
    teamName?: string;
    opponentName?: string;
    opponentLogo?: string;
  };
  allTeams?: Array<{
    id: string;
    name: string;
    logo?: string;
  }>;
  isFlipped?: boolean;
  hideTeamLogos?: boolean;
}

const PitchHeader: React.FC<PitchHeaderProps> = ({
  leftContent,
  centerContent,
  rightContent,
  rightExtraContent,
  matchInfo,
  allTeams = [],
  isFlipped = false,
  hideTeamLogos = false,
}) => {
  const { isPresentationMode } = usePresentationMode();
  // Renderowanie logów zespołów
  const maskName = (name?: string | null) => {
    if (!name) return "";
    if (!isPresentationMode) return name;
    return "Zespół";
  };

  const renderTeamLogos = () => {
    if (hideTeamLogos) return null;

    const showLogos = !isPresentationMode;

    return (
      <div className={styles.teamLogos}>
        {isFlipped ? (
          <>
            <div className={styles.teamLogo}>
              <span className={styles.attackDirection} title="Kierunek ataku">
                ←
              </span>
              {showLogos && (() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img
                    src={teamData.logo}
                    alt="Logo zespołu"
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{maskName((() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.teamName || matchInfo?.team || 'Nasz zespół';
              })())}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              {showLogos && matchInfo?.opponentLogo && (
                <img
                  src={matchInfo.opponentLogo}
                  alt="Logo przeciwnika"
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{maskName(matchInfo?.opponentName || matchInfo?.opponent || 'Przeciwnik')}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.teamLogo}>
              {showLogos && matchInfo?.opponentLogo && (
                <img
                  src={matchInfo.opponentLogo}
                  alt="Logo przeciwnika"
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{maskName(matchInfo?.opponentName || matchInfo?.opponent || 'Przeciwnik')}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              <span className={styles.attackDirection} title="Kierunek ataku">
                →
              </span>
              {showLogos && (() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img
                    src={teamData.logo}
                    alt="Logo zespołu"
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{maskName((() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.teamName || matchInfo?.team || 'Nasz zespół';
              })())}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.pitchHeader}>
      <div className={styles.pitchHeaderLeft}>
        {leftContent}
      </div>
      <div className={styles.pitchHeaderCenter}>
        {centerContent || (!hideTeamLogos && renderTeamLogos())}
      </div>
      <div className={styles.pitchHeaderRight}>
        {rightContent}
        {rightExtraContent}
      </div>
    </div>
  );
};

export default PitchHeader;
