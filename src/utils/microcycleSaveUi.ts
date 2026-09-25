export type MicrocycleSaveStatus = "idle" | "saving" | "saved";

export function microcycleSaveButtonLabel(status: MicrocycleSaveStatus): string {
  if (status === "saving") return "Zapisywanie…";
  if (status === "saved") return "Zapisano";
  return "Zapisz";
}

export function resolveMicrocycleSaveStatus(
  saving: boolean,
  dirty: boolean
): MicrocycleSaveStatus {
  if (saving) return "saving";
  if (!dirty) return "saved";
  return "idle";
}
