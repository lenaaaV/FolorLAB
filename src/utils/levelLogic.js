import { BADGES } from '../constants';

export const calculateLevel = (visitedPoints) => {
    const pointsCount = visitedPoints.length;

    // Calculate XP from visits (100 XP per visit)
    let xp = pointsCount * 100;

    // Calculate XP from badges (500 XP per badge)
    const unlockedBadgesCount = BADGES.filter(b => pointsCount >= b.threshold).length;
    xp += unlockedBadgesCount * 500;

    // Level calculation (1 Level per 1000 XP)
    const level = Math.floor(xp / 1000) + 1;
    const currentLevelXP = xp % 1000;
    const nextLevelXP = 1000;
    const progress = (currentLevelXP / nextLevelXP) * 100;

    return {
        level,
        currentXP: currentLevelXP,
        nextLevelXP,
        progress,
        totalXP: xp
    };
};
