import { Punch } from '../storage/punchStorage';

/**
 * Calculates the total hours worked today based on punch data
 * @param punches Array of punch records with timestamps
 * @returns Total hours worked today as a number with 2 decimal places
 */
export function calculateHoursWorkedToday(punches: Punch[]): number {
  if (!punches || punches.length === 0) return 0;

  // Get start of today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter punches to only include today's punches
  const todaysPunches = punches.filter(punch => {
    const punchDate = new Date(punch.timestamp);
    return punchDate >= today;
  });

  if (todaysPunches.length === 0) return 0;

  // Sort punches by timestamp
  const sortedPunches = [...todaysPunches].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalMilliseconds = 0;
  let lastInPunch: Date | null = null;

  // Calculate total time
  for (const punch of sortedPunches) {
    const punchTime = new Date(punch.timestamp);

    if (punch.type === 'in') {
      lastInPunch = punchTime;
    } else if (punch.type === 'out' && lastInPunch) {
      // Calculate duration between in and out punch
      totalMilliseconds += punchTime.getTime() - lastInPunch.getTime();
      lastInPunch = null;
    }
  }

  // If there's an unclosed "in" punch, calculate time until now
  if (lastInPunch) {
    totalMilliseconds += new Date().getTime() - lastInPunch.getTime();
  }

  // Convert milliseconds to hours and round to 2 decimal places
  return Number((totalMilliseconds / (1000 * 60 * 60)).toFixed(2));
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
 */
export function getDailyTotals(punches: Punch[]): { date: Date; hours: number }[] {
  if (!punches || punches.length === 0) return [];

  const punchesByDay = new Map<string, Punch[]>();

  // Group punches by day
  punches.forEach(punch => {
    const date = new Date(punch.timestamp);
    const dayKey = date.toISOString().split('T')[0];
    
    if (!punchesByDay.has(dayKey)) {
      punchesByDay.set(dayKey, []);
    }
    punchesByDay.get(dayKey)!.push(punch);
  });

  // Calculate totals for each day
  return Array.from(punchesByDay.entries()).map(([dayKey, dayPunches]) => ({
    date: new Date(dayKey),
    hours: calculateTotalHours(dayPunches)
  })).sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending
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