"use client";

import React from "react";
import styles from "./PitchHeader.module.css";

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
  // Renderowanie logów zespołów
  const renderTeamLogos = () => {
    if (hideTeamLogos) return null;

    return (
      <div className={styles.teamLogos}>
        {isFlipped ? (
          <>
            <div className={styles.teamLogo}>
              <span className={styles.attackDirection} title="Kierunek ataku">
                ←
              </span>
              {(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img
                    src={teamData.logo}
                    alt="Logo zespołu"
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.teamName || matchInfo?.team || 'Nasz zespół';
              })()}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              {matchInfo?.opponentLogo && (
                <img
                  src={matchInfo.opponentLogo}
                  alt="Logo przeciwnika"
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{matchInfo?.opponentName || matchInfo?.opponent || 'Przeciwnik'}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.teamLogo}>
              {matchInfo?.opponentLogo && (
                <img
                  src={matchInfo.opponentLogo}
                  alt="Logo przeciwnika"
                  className={styles.teamLogoImage}
                />
              )}
              <span className={styles.teamName}>{matchInfo?.opponentName || matchInfo?.opponent || 'Przeciwnik'}</span>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamLogo}>
              <span className={styles.attackDirection} title="Kierunek ataku">
                →
              </span>
              {(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.logo ? (
                  <img
                    src={teamData.logo}
                    alt="Logo zespołu"
                    className={styles.teamLogoImage}
                  />
                ) : null;
              })()}
              <span className={styles.teamName}>{(() => {
                const teamData = allTeams.find(team => team.id === matchInfo?.team);
                return teamData?.name || matchInfo?.teamName || matchInfo?.team || 'Nasz zespół';
              })()}</span>
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
