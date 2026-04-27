export const HOT_ICE_LEVEL = 'no ice';
export const DEFAULT_ICE_LEVEL = 'regular ice';

export const SIZE_OPTIONS = [
  { id: '12oz', label: '12 oz', upcharge: 0 },
  { id: '16oz', label: '16 oz', upcharge: 0.5 },
  { id: '24oz', label: '24 oz', upcharge: 1 },
];

export const DEFAULT_SIZE_OPTION = SIZE_OPTIONS[0];

export function getSizeOption(sizeId) {
  return SIZE_OPTIONS.find((size) => size.id === sizeId) || DEFAULT_SIZE_OPTION;
}

export function calculateCustomizedDrinkPrice({ basePrice, toppingCount = 0, sizeId = DEFAULT_SIZE_OPTION.id }) {
  const size = getSizeOption(sizeId);
  return Number((Number(basePrice || 0) + Number(toppingCount || 0) * 0.5 + size.upcharge).toFixed(2));
}
