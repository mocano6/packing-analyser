// src/components/FootballPitch/utils.ts

/**
 * Zwraca kolor tła komórki w zależności od wartości expected threat (xT)
 */
export const getXTColor = (xTValue: number): string => {
  // Normalizacja do zakresu 0-1 używając faktycznych min/max z danych
  const MIN_XT = 0.00638303;
  const MAX_XT = 0.25745362;
  const normalizedValue = (xTValue - MIN_XT) / (MAX_XT - MIN_XT);

  if (normalizedValue < 0.2) {
  } else if (normalizedValue < 0.4) {
    return `rgba(239, 140, 11, 0.63)`; // jasnoniebieski dla niskich wartości
  } else if (normalizedValue < 0.6) {
    return `rgb(127, 90, 213, 0.6)`; // jaśniejszy żółty dla średnich wartości
  } else if (normalizedValue < 0.8) {
    return `rgb(139, 37, 207)`; // intensywniejszy pomarańczowy dla wysokich wartości
  } else {
    return `rgba(241, 58, 12, 0.8)`; // intensywniejszy czerwony dla najwyższych wartości
  }
};

/**
 * Oblicza różnicę między dwiema wartościami xT
 */
export const calculateXTDifference = (
  firstValue: number,
  secondValue: number
): number => {
  return secondValue - firstValue;
};
