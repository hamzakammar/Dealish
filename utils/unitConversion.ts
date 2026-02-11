import { UNIT_CONVERSIONS } from '@/types/inventory';

/**
 * Convert a quantity from one unit to another
 * @param quantity - The quantity to convert
 * @param fromUnit - The source unit
 * @param toUnit - The target unit
 * @returns The converted quantity, or null if conversion is not possible
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  // Same unit, no conversion needed
  if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return quantity;
  }

  // Try to find conversion in weight conversions
  const weightConv = UNIT_CONVERSIONS.weight.find(
    (c) => c.from.toLowerCase() === fromUnit.toLowerCase() && c.to.toLowerCase() === toUnit.toLowerCase()
  );
  if (weightConv) {
    return quantity * weightConv.factor;
  }

  // Try reverse weight conversion
  const reverseWeightConv = UNIT_CONVERSIONS.weight.find(
    (c) => c.from.toLowerCase() === toUnit.toLowerCase() && c.to.toLowerCase() === fromUnit.toLowerCase()
  );
  if (reverseWeightConv) {
    return quantity / reverseWeightConv.factor;
  }

  // Try to find conversion in volume conversions
  const volumeConv = UNIT_CONVERSIONS.volume.find(
    (c) => c.from.toLowerCase() === fromUnit.toLowerCase() && c.to.toLowerCase() === toUnit.toLowerCase()
  );
  if (volumeConv) {
    return quantity * volumeConv.factor;
  }

  // Try reverse volume conversion
  const reverseVolumeConv = UNIT_CONVERSIONS.volume.find(
    (c) => c.from.toLowerCase() === toUnit.toLowerCase() && c.to.toLowerCase() === fromUnit.toLowerCase()
  );
  if (reverseVolumeConv) {
    return quantity / reverseVolumeConv.factor;
  }

  // Try indirect conversion through base units
  // For weight: convert to grams first, then to target
  const toGrams = UNIT_CONVERSIONS.weight.find(
    (c) => c.from.toLowerCase() === fromUnit.toLowerCase() && c.to === 'g'
  );
  const fromGrams = UNIT_CONVERSIONS.weight.find(
    (c) => c.from === 'g' && c.to.toLowerCase() === toUnit.toLowerCase()
  );
  if (toGrams && fromGrams) {
    return (quantity * toGrams.factor) / fromGrams.factor;
  }

  // For volume: convert to ml first, then to target
  const toMl = UNIT_CONVERSIONS.volume.find(
    (c) => c.from.toLowerCase() === fromUnit.toLowerCase() && c.to === 'ml'
  );
  const fromMl = UNIT_CONVERSIONS.volume.find(
    (c) => c.from === 'ml' && c.to.toLowerCase() === toUnit.toLowerCase()
  );
  if (toMl && fromMl) {
    return (quantity * toMl.factor) / fromMl.factor;
  }

  // No conversion found
  return null;
}

/**
 * Check if two units are compatible (same type: weight, volume, or count)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  if (unit1.toLowerCase() === unit2.toLowerCase()) {
    return true;
  }

  const weightUnits = ['g', 'kg', 'oz', 'lb', 'lbs', 'gram', 'kilogram', 'ounce', 'pound'];
  const volumeUnits = ['ml', 'l', 'liter', 'fl oz', 'cup', 'pint', 'quart', 'gallon'];
  const countUnits = ['each', 'piece', 'unit', 'item', 'case', 'box', 'pack'];

  const unit1Lower = unit1.toLowerCase();
  const unit2Lower = unit2.toLowerCase();

  const unit1IsWeight = weightUnits.some((u) => unit1Lower.includes(u));
  const unit2IsWeight = weightUnits.some((u) => unit2Lower.includes(u));
  const unit1IsVolume = volumeUnits.some((u) => unit1Lower.includes(u));
  const unit2IsVolume = volumeUnits.some((u) => unit2Lower.includes(u));
  const unit1IsCount = countUnits.some((u) => unit1Lower.includes(u));
  const unit2IsCount = countUnits.some((u) => unit2Lower.includes(u));

  return (
    (unit1IsWeight && unit2IsWeight) ||
    (unit1IsVolume && unit2IsVolume) ||
    (unit1IsCount && unit2IsCount)
  );
}

/**
 * Normalize a unit name to a standard format
 */
export function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();

  // Weight units
  if (normalized === 'lbs' || normalized === 'pound' || normalized === 'pounds') return 'lb';
  if (normalized === 'oz' || normalized === 'ounce' || normalized === 'ounces') return 'oz';
  if (normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilograms') return 'kg';
  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') return 'g';

  // Volume units
  if (normalized === 'l' || normalized === 'liter' || normalized === 'liters' || normalized === 'litre' || normalized === 'litres') return 'liter';
  if (normalized === 'ml' || normalized === 'milliliter' || normalized === 'milliliters' || normalized === 'millilitre' || normalized === 'millilitres') return 'ml';
  if (normalized === 'fl oz' || normalized === 'fluid ounce' || normalized === 'fluid ounces') return 'fl oz';
  if (normalized === 'gal' || normalized === 'gallon' || normalized === 'gallons') return 'gallon';

  // Count units
  if (normalized === 'piece' || normalized === 'pieces' || normalized === 'unit' || normalized === 'units' || normalized === 'item' || normalized === 'items') return 'each';

  return normalized;
}

/**
 * Format a quantity with unit for display
 */
export function formatQuantity(quantity: number, unit: string): string {
  // Round to 2 decimal places for display
  const rounded = Math.round(quantity * 100) / 100;
  
  // If it's a whole number, don't show decimals
  if (rounded % 1 === 0) {
    return `${rounded} ${unit}`;
  }
  
  return `${rounded.toFixed(2)} ${unit}`;
}
