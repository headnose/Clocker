import { Punch } from '../storage/punchStorage';

/**
 * Calculates the total hours worked today based on punch data
 * @param punches Array of punch records with timestamps
 * @returns Total hours worked today as a number with 2 decimal places
 */
export function calculateHoursWorkedToday(allPunches: Punch[]): number {
  if (!allPunches || allPunches.length === 0) return 0;

  let totalHoursToday = 0;
  const todayStart = getStartOfDay(new Date());
  const todayEnd = getEndOfDay(new Date());

  const sortedPunches = [...allPunches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let lastInPunch: Punch | null = null;

  for (const currentPunch of sortedPunches) {
    if (currentPunch.type === 'in') {
      // If there was a previous 'in' punch without an 'out' (dangling punch),
      // we effectively overwrite it. The logic below handles the LATEST 'in' punch correctly.
      lastInPunch = currentPunch;
    } else if (currentPunch.type === 'out' && lastInPunch) {
      const tIn = new Date(lastInPunch.timestamp);
      const tOut = new Date(currentPunch.timestamp);

      if (tOut <= tIn) { // Skip invalid or zero-duration pairs
        lastInPunch = null;
        continue;
      }

      const sessionStart = tIn;
      const sessionEnd = tOut;

      const effectiveStart = sessionStart < todayStart ? todayStart : sessionStart;
      const effectiveEnd = sessionEnd > todayEnd ? todayEnd : sessionEnd;

      if (effectiveStart < effectiveEnd) { 
        totalHoursToday += calculateHoursBetween(effectiveStart, effectiveEnd);
      }
      lastInPunch = null; // This session is now closed
    }
  }

  // Handle a currently active session (a final 'in' punch without a corresponding 'out')
  if (lastInPunch) {
    const tIn = new Date(lastInPunch.timestamp);
    const tNow = new Date();

    if (tNow > tIn) { 
      const effectiveStart = tIn < todayStart ? todayStart : tIn;
      // For an active session, effectiveEnd is 'now' unless 'now' is past todayEnd, then it's todayEnd.
      // However, we only care about the portion *up to now* that falls within today.
      const capAtNow = tNow > todayEnd ? todayEnd : tNow; // Don't calculate beyond 'now' or 'todayEnd'

      if (effectiveStart < capAtNow) { // ensure there is a valid interval within today up to now
        totalHoursToday += calculateHoursBetween(effectiveStart, capAtNow);
      }
    }
  }

  return Number(totalHoursToday.toFixed(2));
}

/**
 * Formats hours into a readable string
 * @param hours Number of hours
 * @returns Formatted string (e.g., "8.50 hours" or "30 minutes")
 */
export function formatHours(hours: number): string {
  if (hours === 0) return '0 hours';
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Checks if two punches are from the same day
 * @param timestamp1 First timestamp
 * @param timestamp2 Second timestamp
 * @returns boolean indicating if punches are from the same day
 */
export function isSameDay(timestamp1: string, timestamp2: string): boolean {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Gets the start of the week (Sunday) for a given date
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(date.getDate() - date.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of the week (Saturday) for a given date
 */
export function getEndOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(date.getDate() - date.getDay() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Gets the start of the day
 */
export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of the day
 */
export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Calculates hours worked between two timestamps
 */
export function calculateHoursBetween(startTime: Date, endTime: Date): number {
  const milliseconds = endTime.getTime() - startTime.getTime();
  return Number((milliseconds / (1000 * 60 * 60)).toFixed(2));
}

/**
 * Calculates total hours worked for a set of punches
 */
export function calculateTotalHours(punches: Punch[]): number {
  if (!punches || punches.length === 0) return 0;

  let totalMilliseconds = 0;
  let lastInPunch: Date | null = null;

  // Sort punches by timestamp
  const sortedPunches = [...punches].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const punch of sortedPunches) {
    const punchTime = new Date(punch.timestamp);

    if (punch.type === 'in') {
      lastInPunch = punchTime;
    } else if (punch.type === 'out' && lastInPunch) {
      totalMilliseconds += punchTime.getTime() - lastInPunch.getTime();
      lastInPunch = null;
    }
  }

  // If there's an unclosed "in" punch, calculate time until now
  if (lastInPunch) {
    totalMilliseconds += new Date().getTime() - lastInPunch.getTime();
  }

  return Number((totalMilliseconds / (1000 * 60 * 60)).toFixed(2));
}

/**
 * Groups punches by day and calculates daily totals
 * Accurately splits hours for shifts that cross midnight.
 */
export function getDailyTotals(allPunches: Punch[]): { date: Date; hours: number }[] {
  if (!allPunches || allPunches.length === 0) return [];

  const dailyHoursMap = new Map<string, number>(); // Key: "YYYY-MM-DD", Value: hours

  // Sort all punches chronologically (oldest first)
  const sortedPunches = [...allPunches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let lastInPunch: Punch | null = null;

  for (const currentPunch of sortedPunches) {
    if (currentPunch.type === 'in') {
      // If there was a previous 'in' punch without an 'out' (dangling punch),
      // we will effectively ignore it here as a new 'in' punch starts a new session.
      // More sophisticated handling for multiple incomplete 'in' punches could be added if needed.
      lastInPunch = currentPunch;
    } else if (currentPunch.type === 'out' && lastInPunch) {
      const tIn = new Date(lastInPunch.timestamp);
      const tOut = new Date(currentPunch.timestamp);

      // Ensure tOut is after tIn, otherwise skip this pair (data integrity issue)
      if (tOut <= tIn) {
        lastInPunch = null; // Reset to avoid issues with malformed data
        continue;
      }

      let currentSegmentStart = new Date(tIn);

      while (currentSegmentStart < tOut) {
        const dayKey = `${currentSegmentStart.getFullYear()}-${String(currentSegmentStart.getMonth() + 1).padStart(2, '0')}-${String(currentSegmentStart.getDate()).padStart(2, '0')}`;
        
        const endOfCurrentDay = getEndOfDay(new Date(currentSegmentStart));
        const segmentEnd = tOut < endOfCurrentDay ? new Date(tOut) : endOfCurrentDay;

        // Ensure segmentEnd is not before currentSegmentStart (can happen with tiny fractions of a second or bad data)
        if (segmentEnd > currentSegmentStart) {
            const hoursThisSegment = calculateHoursBetween(currentSegmentStart, segmentEnd);
            dailyHoursMap.set(dayKey, (dailyHoursMap.get(dayKey) || 0) + hoursThisSegment);
        }
        
        const nextDayStart = getStartOfDay(new Date(currentSegmentStart));
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        
        // Break if nextDayStart is already past tOut to prevent infinite loops on same-day segments ending at midnight
        if (nextDayStart > tOut && isSameDay(currentSegmentStart.toISOString(), tOut.toISOString()) ){
            if(tOut.getHours() === 0 && tOut.getMinutes() === 0 && tOut.getSeconds() === 0 && tOut.getMilliseconds() === 0 && !isSameDay(tIn.toISOString(), tOut.toISOString())){
                // If tOut is exactly midnight and it's a different day than tIn, the loop for the previous day already handled up to its EOD.
                // We need to ensure the new day (tOut's day) gets its 0 hours if no work was done on it.
                 const tOutDayKey = `${tOut.getFullYear()}-${String(tOut.getMonth() + 1).padStart(2, '0')}-${String(tOut.getDate()).padStart(2, '0')}`;
                 if (!dailyHoursMap.has(tOutDayKey)) {
                    dailyHoursMap.set(tOutDayKey, 0);
                 }
            }
            break;
        }
        currentSegmentStart = nextDayStart;
      }
      lastInPunch = null; 
    }
  }
  
  // Handle a final dangling 'in' punch (currently clocked in)
  if (lastInPunch) {
      const tIn = new Date(lastInPunch.timestamp);
      const tNow = new Date(); 

      if (tNow > tIn) { // Ensure current time is after the last clock-in
        let currentSegmentStart = new Date(tIn);
        while (currentSegmentStart < tNow) {
            const dayKey = `${currentSegmentStart.getFullYear()}-${String(currentSegmentStart.getMonth() + 1).padStart(2, '0')}-${String(currentSegmentStart.getDate()).padStart(2, '0')}`;
            const endOfCurrentDay = getEndOfDay(new Date(currentSegmentStart));
            const segmentEnd = tNow < endOfCurrentDay ? new Date(tNow) : endOfCurrentDay;

            if (segmentEnd > currentSegmentStart) {
                const hoursThisSegment = calculateHoursBetween(currentSegmentStart, segmentEnd);
                dailyHoursMap.set(dayKey, (dailyHoursMap.get(dayKey) || 0) + hoursThisSegment);
            }

            const nextDayStart = getStartOfDay(new Date(currentSegmentStart));
            nextDayStart.setDate(nextDayStart.getDate() + 1);

            if (nextDayStart > tNow && isSameDay(currentSegmentStart.toISOString(), tNow.toISOString())){
                 break;
            }
            currentSegmentStart = nextDayStart;
        }
      }
  }

  // Convert map to array, ensure all days within the range of punches are present (even with 0 hours), and sort
  if (sortedPunches.length > 0 && dailyHoursMap.size > 0) {
    const firstPunchDate = getStartOfDay(new Date(sortedPunches[0].timestamp));
    const lastPunchDate = getStartOfDay(new Date(sortedPunches[sortedPunches.length - 1].timestamp));
    
    // Ensure all days from the first punch to the last punch (or today if still clocked in) are in the map
    let currentDate = new Date(firstPunchDate);
    const endDateLimit = lastInPunch ? getStartOfDay(new Date()) : lastPunchDate;

    while (currentDate <= endDateLimit) {
      const dayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      if (!dailyHoursMap.has(dayKey)) {
        dailyHoursMap.set(dayKey, 0);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }


  return Array.from(dailyHoursMap.entries())
    .map(([dayKey, hours]) => {
      const parts = dayKey.split('-').map(Number);
      return {
        date: new Date(parts[0], parts[1] - 1, parts[2]),
        hours: Number(hours.toFixed(2)),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Groups punches by week and calculates weekly totals
 */
export function getWeeklyTotals(punches: Punch[]): { weekStart: Date; hours: number }[] {
  if (!punches || punches.length === 0) return [];

  const punchesByWeek = new Map<string, Punch[]>();

  // Group punches by week
  punches.forEach(punch => {
    const date = new Date(punch.timestamp);
    const weekStart = getStartOfWeek(date);
    const weekKey = weekStart.toISOString();
    
    if (!punchesByWeek.has(weekKey)) {
      punchesByWeek.set(weekKey, []);
    }
    punchesByWeek.get(weekKey)!.push(punch);
  });

  // Calculate totals for each week
  return Array.from(punchesByWeek.entries()).map(([weekKey, weekPunches]) => ({
    weekStart: new Date(weekKey),
    hours: calculateTotalHours(weekPunches)
  })).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime()); // Sort by week descending
} 