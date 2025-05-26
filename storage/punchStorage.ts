import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Punch {
  timestamp: string;
  type: 'in' | 'out';
}

const STORAGE_KEYS = {
  PUNCHES: 'punches',
  CLOCK_STATE: 'clockState',
} as const;

/**
 * Saves a new punch to storage
 * @param punch The punch to save
 * @throws Error if saving fails
 */
export async function savePunch(punch: Punch): Promise<void> {
  try {
    const punches = await loadPunches();
    punches.push(punch);
    await AsyncStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(punches));
  } catch (error) {
    console.error('Error saving punch:', error);
    throw new Error('Failed to save punch');
  }
}

/**
 * Loads all punches from storage
 * @returns Array of punches, sorted by timestamp (newest first)
 */
export async function loadPunches(): Promise<Punch[]> {
  try {
    const punchesJson = await AsyncStorage.getItem(STORAGE_KEYS.PUNCHES);
    if (!punchesJson) return [];

    const punches: Punch[] = JSON.parse(punchesJson);
    return punches.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error loading punches:', error);
    return [];
  }
}

/**
 * Clears all punches from storage
 * @throws Error if clearing fails
 */
export async function clearPunches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PUNCHES);
  } catch (error) {
    console.error('Error clearing punches:', error);
    throw new Error('Failed to clear punches');
  }
}

/**
 * Saves the current clock state
 * @param isClockIn Whether the user is clocking in (true) or out (false)
 * @throws Error if saving fails
 */
export async function saveClockState(isClockIn: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CLOCK_STATE, isClockIn ? 'in' : 'out');
  } catch (error) {
    console.error('Error saving clock state:', error);
    throw new Error('Failed to save clock state');
  }
}

/**
 * Loads the current clock state
 * @returns boolean indicating if user is currently clocked in
 */
export async function loadClockState(): Promise<boolean> {
  try {
    const state = await AsyncStorage.getItem(STORAGE_KEYS.CLOCK_STATE);
    return state === 'in';
  } catch (error) {
    console.error('Error loading clock state:', error);
    return false;
  }
}

/**
 * Deletes a specific punch by its timestamp
 * @param timestamp The timestamp of the punch to delete
 * @throws Error if deletion fails
 */
export async function deletePunch(timestamp: string): Promise<void> {
  try {
    const punches = await loadPunches();
    const filteredPunches = punches.filter(punch => punch.timestamp !== timestamp);
    await AsyncStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(filteredPunches));
  } catch (error) {
    console.error('Error deleting punch:', error);
    throw new Error('Failed to delete punch');
  }
}

/**
 * Updates an existing punch
 * @param oldTimestamp The timestamp of the punch to update
 * @param updatedPunch The new punch data
 * @throws Error if update fails
 */
export async function updatePunch(oldTimestamp: string, updatedPunch: Punch): Promise<void> {
  try {
    const punches = await loadPunches();
    const updatedPunches = punches.map(punch => 
      punch.timestamp === oldTimestamp ? updatedPunch : punch
    );
    await AsyncStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(updatedPunches));
  } catch (error) {
    console.error('Error updating punch:', error);
    throw new Error('Failed to update punch');
  }
}

/**
 * Gets punches within a date range
 * @param startDate Start date of the range
 * @param endDate End date of the range
 * @returns Array of punches within the specified date range
 */
export async function getPunchesInRange(startDate: Date, endDate: Date): Promise<Punch[]> {
  try {
    const punches = await loadPunches();
    return punches.filter(punch => {
      const punchDate = new Date(punch.timestamp);
      return punchDate >= startDate && punchDate <= endDate;
    });
  } catch (error) {
    console.error('Error getting punches in range:', error);
    return [];
  }
}

export const resetAllData = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.CLOCK_STATE),
      AsyncStorage.removeItem(STORAGE_KEYS.PUNCHES)
    ]);
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
}; 