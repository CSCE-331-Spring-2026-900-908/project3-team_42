export const BOBAS_PER_FREE_REWARD = 5;

export function calculateOrderRewardPoints(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function buildRewardsSummary(pointsBalance) {
  const normalizedBalance = Math.max(0, Number(pointsBalance || 0));
  const progressCount = normalizedBalance % BOBAS_PER_FREE_REWARD;

  return {
    pointsBalance: normalizedBalance,
    freeBobaCount: Math.floor(normalizedBalance / BOBAS_PER_FREE_REWARD),
    pointsToNextFreeBoba:
      progressCount === 0 ? BOBAS_PER_FREE_REWARD : BOBAS_PER_FREE_REWARD - progressCount,
    progressCount,
  };
}
