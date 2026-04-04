import { getDB } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc } from "@/lib/firestoreWithMetrics";
import { DEFAULT_TRENDY_KPI_DEFINITIONS, TrendyKpiDefinition } from "@/utils/trendyKpis";

const COLLECTION_NAME = "kpiDefinitions";

const isValidDirection = (value: unknown): value is TrendyKpiDefinition["direction"] =>
  value === "higher" || value === "lower";

const isValidUnit = (value: unknown): value is TrendyKpiDefinition["unit"] =>
  value === "percent" || value === "number" || value === "ratio" || value === "seconds";

const toDefinition = (raw: unknown, fallback: TrendyKpiDefinition): TrendyKpiDefinition => {
  const source = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof source.id === "string" ? source.id : fallback.id,
    label: typeof source.label === "string" ? source.label : fallback.label,
    target: typeof source.target === "number" && Number.isFinite(source.target) ? source.target : fallback.target,
    direction: isValidDirection(source.direction) ? source.direction : fallback.direction,
    unit: isValidUnit(source.unit) ? source.unit : fallback.unit,
    active: typeof source.active === "boolean" ? source.active : fallback.active,
    order: typeof source.order === "number" && Number.isFinite(source.order) ? source.order : fallback.order,
    description: typeof source.description === "string" ? source.description : fallback.description,
  };
};

export const loadTrendyKpiDefinitions = async (): Promise<TrendyKpiDefinition[]> => {
  const ref = collection(getDB(), COLLECTION_NAME);
  const snapshot = await getDocs(ref);
  const fromDb = new Map<string, Record<string, unknown>>();
  snapshot.docs.forEach((item) => fromDb.set(item.id, item.data() as Record<string, unknown>));

  const merged = DEFAULT_TRENDY_KPI_DEFINITIONS.map((fallback) => {
    const existing = fromDb.get(fallback.id);
    return existing ? toDefinition(existing, fallback) : fallback;
  });

  // Dopuszczamy dodatkowe KPI dodane przez admina poza listą domyślną.
  snapshot.docs.forEach((item) => {
    if (merged.some((def) => def.id === item.id)) return;
    const raw = item.data() as Record<string, unknown>;
    const fallback: TrendyKpiDefinition = {
      id: item.id,
      label: item.id,
      target: 0,
      direction: "higher",
      unit: "number",
      active: true,
      order: 999,
    };
    merged.push(toDefinition(raw, fallback));
  });

  return merged.sort((a, b) => a.order - b.order);
};

export const saveTrendyKpiDefinition = async (definition: TrendyKpiDefinition): Promise<void> => {
  const ref = doc(getDB(), COLLECTION_NAME, definition.id);
  // Firestore nie akceptuje wartości `undefined` ani `NaN`.
  // Sanitizujemy payload, żeby admin mógł zapisywać edycje bez losowych błędów.
  const payload: Record<string, unknown> = {
    id: definition.id,
    label: definition.label,
    target: Number.isFinite(definition.target) ? definition.target : 0,
    direction: definition.direction,
    unit: definition.unit,
    active: definition.active,
    order: Number.isFinite(definition.order) ? definition.order : 0,
  };

  if (typeof definition.description === "string" && definition.description.trim().length > 0) {
    payload.description = definition.description;
  }

  await setDoc(ref, payload, { merge: true });
};

export const seedDefaultTrendyKpisIfEmpty = async (): Promise<void> => {
  const ref = collection(getDB(), COLLECTION_NAME);
  const snapshot = await getDocs(ref);
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_TRENDY_KPI_DEFINITIONS.map((item) => {
      const itemRef = doc(getDB(), COLLECTION_NAME, item.id);
      return setDoc(itemRef, item, { merge: true });
    })
  );
};
