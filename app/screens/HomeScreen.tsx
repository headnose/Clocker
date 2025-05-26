import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import {
  Punch,
  loadClockState,
  loadPunches,
  resetAllData,
  saveClockState,
  savePunch,
} from "../../storage/punchStorage";
import { calculateHoursWorkedToday, formatHours } from "../../utils/timeUtils";

const colors = {
  dark: {
    background: "#1a1a1a",
    card: "#2a2a2a",
    text: "#ffffff",
    subtext: "#a0a0a0",
    clockIn: "#4CAF50",
    clockOut: "#ff4444",
    shadow: "#000000",
  },
  light: {
    background: "#ffffff",
    card: "#f8f9fa",
    text: "#000000",
    subtext: "#666666",
    clockIn: "#4CAF50",
    clockOut: "#ff4444",
    shadow: "#000000",
  },
};

export default function HomeScreen() {
  const [isClockedIn, setIsClockedIn] = useState<boolean>(false);
  const [hoursWorked, setHoursWorked] = useState<number>(0);
  const [punches, setPunches] = useState<Punch[]>([]);
  const colorScheme = useColorScheme();
  const theme = colors[colorScheme === "dark" ? "dark" : "light"];

  useEffect(() => {
    // Load the initial state when component mounts
    loadInitialState();
  }, []);

  // Update hours worked every minute when clocked in
  useEffect(() => {
    if (isClockedIn) {
      const timer = setInterval(() => {
        setHoursWorked(calculateHoursWorkedToday(punches));
      }, 60000); // Update every minute
      return () => clearInterval(timer);
    }
  }, [isClockedIn, punches]);

  const loadInitialState = async () => {
    try {
      const [clockedIn, savedPunches] = await Promise.all([
        loadClockState(),
        loadPunches(),
      ]);

      setIsClockedIn(clockedIn);
      setPunches(savedPunches);
      setHoursWorked(calculateHoursWorkedToday(savedPunches));
    } catch (error) {
      Alert.alert("Error", "Failed to load clock state");
    }
  };

  const handleClockPress = async () => {
    try {
      const newState = !isClockedIn;
      const punchType = newState ? "in" : "out";

      // Create new punch record
      const punch: Punch = {
        timestamp: new Date().toISOString(),
        type: punchType,
      };

      // Save both clock state and punch
      await Promise.all([saveClockState(newState), savePunch(punch)]);

      // Update local state
      const updatedPunches = [...punches, punch];
      setPunches(updatedPunches);
      setIsClockedIn(newState);
      setHoursWorked(calculateHoursWorkedToday(updatedPunches));
    } catch (error) {
      Alert.alert("Error", "Failed to save clock state");
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Reset All Data",
      "Are you sure you want to reset all clock data? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await resetAllData();
              setIsClockedIn(false);
              setPunches([]);
              setHoursWorked(0);
              Alert.alert("Success", "All data has been reset");
            } catch (error) {
              Alert.alert("Error", "Failed to reset data");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isClockedIn ? theme.clockOut : theme.clockIn,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={handleClockPress}
      >
        <Text style={[styles.buttonText, { color: theme.text }]}>
          {isClockedIn ? "Clock Out" : "Clock In"}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.status, { color: theme.subtext }]}>
        Status: {isClockedIn ? "Clocked In" : "Clocked Out"}
      </Text>
      <Text style={[styles.hours, { color: theme.text }]}>
        Hours Today: {formatHours(hoursWorked)}
      </Text>
      <TouchableOpacity
        style={[styles.resetButton, { borderColor: theme.clockOut }]}
        onPress={handleReset}
      >
        <Text style={[styles.resetButtonText, { color: theme.clockOut }]}>
          Reset All Data
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 25,
    elevation: 3,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  status: {
    marginTop: 20,
    fontSize: 16,
  },
  hours: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  resetButton: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
