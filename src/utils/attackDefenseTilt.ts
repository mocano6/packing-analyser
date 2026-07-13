export type TiltDirection = "attack" | "defense" | "balanced";

export type AttackDefenseTilt = {
  attackXt: number;
  defenseXt: number;
  totalXt: number;
  /** Udział xT ataku w sumie xT (0–100). */
  attackShare: number;
  /** Udział xT obrony w sumie xT (0–100). */
  defenseShare: number;
  /** Różnica xT (atak − obrona). Dodatnia = przechył w atak. */
  diff: number;
  /** Przechylenie względem środka w punktach procentowych (−50…50). Dodatnie = atak. */
  tiltPct: number;
  /** Magnituda przechyłu jako % połowy skali (0–100). */
  magnitudePct: number;
  direction: TiltDirection;
};

/** Próg (w punktach %), poniżej którego uznajemy rozkład za zrównoważony. */
const BALANCED_THRESHOLD = 3;

export function computeAttackDefenseTilt(
  attackXt: number,
  defenseXt: number,
): AttackDefenseTilt {
  const safeAttack = Number.isFinite(attackXt) ? Math.max(0, attackXt) : 0;
  const safeDefense = Number.isFinite(defenseXt) ? Math.max(0, defenseXt) : 0;
  const totalXt = safeAttack + safeDefense;
  const attackShare = totalXt > 0 ? (safeAttack / totalXt) * 100 : 50;
  const defenseShare = totalXt > 0 ? (safeDefense / totalXt) * 100 : 50;
  const tiltPct = attackShare - 50;
  const magnitudePct = Math.min(100, (Math.abs(tiltPct) / 50) * 100);
  const direction: TiltDirection =
    Math.abs(tiltPct) < BALANCED_THRESHOLD
      ? "balanced"
      : tiltPct > 0
        ? "attack"
        : "defense";
  return {
    attackXt: safeAttack,
    defenseXt: safeDefense,
    totalXt,
    attackShare,
    defenseShare,
    diff: safeAttack - safeDefense,
    tiltPct,
    magnitudePct,
    direction,
  };
}
