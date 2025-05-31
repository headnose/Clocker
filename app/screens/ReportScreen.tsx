import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as MailComposer from "expo-mail-composer";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Punch,
  deletePunch,
  loadPunches,
  resetAllData,
  updatePunch,
} from "../../storage/punchStorage";
import {
  formatHours,
  getDailyTotals,
  getWeeklyTotals,
} from "../../utils/timeUtils";

type SummarySection = {
  title: string;
  data: { label: string; hours: number }[];
};

export default function ReportScreen() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [summaries, setSummaries] = useState<SummarySection[]>([]);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPunch, setEditingPunch] = useState<Punch | null>(null);
  const [editedYear, setEditedYear] = useState("");
  const [editedMonth, setEditedMonth] = useState("");
  const [editedDay, setEditedDay] = useState("");
  const [editedHour, setEditedHour] = useState("");
  const [editedMinute, setEditedMinute] = useState("");
  const [editedType, setEditedType] = useState<Punch["type"]>("in");

  useFocusEffect(
    useCallback(() => {
      loadPunchData();
    }, [])
  );

  const loadPunchData = async () => {
    try {
      const loadedPunches = await loadPunches();
      setPunches(loadedPunches);
      updateSummaries(loadedPunches);
    } catch (error) {
      Alert.alert("Error", "Failed to load punch history");
    }
  };

  const updateSummaries = (loadedPunches: Punch[]) => {
    const dailyTotals = getDailyTotals(loadedPunches);
    const weeklyTotals = getWeeklyTotals(loadedPunches);

    const sections: SummarySection[] = [
      {
        title: "Weekly Totals",
        data: weeklyTotals.map((week) => ({
          label: formatWeekRange(week.weekStart),
          hours: week.hours,
        })),
      },
      {
        title: "Daily Totals",
        data: dailyTotals.map((day) => ({
          label: formatDate(day.date, true),
          hours: day.hours,
        })),
      },
    ];

    setSummaries(sections);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPunchData();
    setRefreshing(false);
  };

  const handleUpdatePunch = async () => {
    if (
      !editingPunch ||
      !editedYear ||
      !editedMonth ||
      !editedDay ||
      !editedHour ||
      !editedMinute
    )
      return;

    try {
      const year = parseInt(editedYear, 10);
      const month = parseInt(editedMonth, 10);
      const day = parseInt(editedDay, 10);
      const hours = parseInt(editedHour, 10);
      const minutes = parseInt(editedMinute, 10);

      if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        isNaN(hours) ||
        isNaN(minutes)
      ) {
        Alert.alert("Error", "Date and time components must be valid numbers.");
        return;
      }

      // Validate date components
      // Basic validation, can be improved with Date object checks for day based on month/year
      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        year < 1900 ||
        year > 2100
      ) {
        Alert.alert(
          "Error",
          "Invalid date components. YYYY (1900-2100), MM (1-12), DD (1-31)."
        );
        return;
      }

      // Validate time components
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        Alert.alert("Error", "Invalid time components. HH (0-23), MM (0-59).");
        return;
      }

      const updatedTimestamp = new Date(
        year,
        month - 1, // Month is 0-indexed in JavaScript Date
        day,
        hours,
        minutes
      ).toISOString();

      const updatedPunchData: Punch = {
        ...editingPunch,
        timestamp: updatedTimestamp,
        type: editedType,
      };

      await updatePunch(editingPunch.timestamp, updatedPunchData);
      await loadPunchData();
      setIsEditModalVisible(false);
      setEditingPunch(null);
      Alert.alert("Success", "Punch updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update punch");
    }
  };

  const handleDeletePunch = async (timestamp: string) => {
    try {
      await deletePunch(timestamp);
      await loadPunchData();
      Alert.alert("Success", "Punch deleted successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to delete punch");
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
              await loadPunchData();
              Alert.alert("Success", "All data has been reset");
            } catch (error) {
              Alert.alert("Error", "Failed to reset data");
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date, includeYear = false) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(includeYear && { year: "numeric" }),
    });
  };

  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  };

  const formatPunchTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderSummaryItem = ({
    item,
  }: {
    item: { label: string; hours: number };
  }) => (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{item.label}</Text>
      <Text style={styles.summaryHours}>{formatHours(item.hours)}</Text>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: SummarySection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderPunchItem = ({ item }: { item: Punch }) => (
    <TouchableOpacity
      style={styles.punchItem}
      onPress={() => {
        setEditingPunch(item);
        const itemDate = new Date(item.timestamp);

        const yearStr = String(itemDate.getFullYear());
        const monthStr = String(itemDate.getMonth() + 1).padStart(2, "0");
        const dayStr = String(itemDate.getDate()).padStart(2, "0");
        const hourStr = String(itemDate.getHours()).padStart(2, "0");
        const minuteStr = String(itemDate.getMinutes()).padStart(2, "0");

        setEditedYear(yearStr);
        setEditedMonth(monthStr);
        setEditedDay(dayStr);
        setEditedHour(hourStr);
        setEditedMinute(minuteStr);
        setEditedType(item.type);
        setIsEditModalVisible(true);
      }}
      onLongPress={() => {
        Alert.alert(
          "Delete Punch",
          "Are you sure you want to delete this punch?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              onPress: () => handleDeletePunch(item.timestamp),
              style: "destructive",
            },
          ]
        );
      }}
    >
      <View style={styles.punchInfo}>
        <Text
          style={[
            styles.punchType,
            { color: item.type === "in" ? "#4CAF50" : "#ff4444" },
          ]}
        >
          {item.type.toUpperCase()}
        </Text>
        <Text style={styles.punchTime}>
          {formatDate(new Date(item.timestamp))}{" "}
          {formatPunchTime(item.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const generateEmailContent = () => {
    let content = "Clock In/Out Report\n\n";

    // Add weekly summaries
    content += "Weekly Totals\n";
    content += "=============\n";
    summaries[0].data.forEach((week) => {
      content += `${week.label}: ${formatHours(week.hours)}\n`;
    });
    content += "\n";

    // Add daily summaries
    content += "Daily Totals\n";
    content += "============\n";
    summaries[1].data.forEach((day) => {
      content += `${day.label}: ${formatHours(day.hours)}\n`;
    });
    content += "\n";

    // Add individual punches
    content += "Detailed Punch History\n";
    content += "=====================\n";
    const sortedPunches = [...punches].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentDay = "";
    sortedPunches.forEach((punch) => {
      const date = new Date(punch.timestamp);
      const dayStr = formatDate(date, true);

      if (currentDay !== dayStr) {
        if (currentDay !== "") content += "\n";
        currentDay = dayStr;
        content += `${dayStr}\n`;
        content += "------------------------\n";
      }

      content += `${punch.type.toUpperCase()}: ${formatPunchTime(
        punch.timestamp
      )}\n`;
    });

    return content;
  };

  const sendEmail = async () => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert(
          "Email Not Available",
          "Would you like to copy the report to clipboard instead?",
          [
            {
              text: "Copy to Clipboard",
              onPress: async () => {
                const content = generateEmailContent();
                await Clipboard.setStringAsync(content);
                Alert.alert("Success", "Report copied to clipboard");
              },
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      await MailComposer.composeAsync({
        subject: "Clock In/Out Report",
        body: generateEmailContent(),
      });
    } catch (error) {
      Alert.alert("Error", "Failed to send email");
    }
  };

  return (
    <View style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => {
          setIsEditModalVisible(false);
          setEditingPunch(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalText}>Edit Punch Date & Time</Text>

              <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={[styles.input, styles.dateInput, styles.yearInput]}
                  onChangeText={setEditedYear}
                  value={editedYear}
                  placeholder="YYYY"
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Text style={styles.dateSeparator}>-</Text>
                <TextInput
                  style={[styles.input, styles.dateInput, styles.monthDayInput]}
                  onChangeText={setEditedMonth}
                  value={editedMonth}
                  placeholder="MM"
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.dateSeparator}>-</Text>
                <TextInput
                  style={[styles.input, styles.dateInput, styles.monthDayInput]}
                  onChangeText={setEditedDay}
                  value={editedDay}
                  placeholder="DD"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>

              <Text style={styles.modalLabel}>Time (HH:MM)</Text>
              <View style={styles.timeInputContainer}>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  onChangeText={setEditedHour}
                  value={editedHour}
                  placeholder="HH"
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  onChangeText={setEditedMinute}
                  value={editedMinute}
                  placeholder="MM"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.typeSelectorContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editedType === "in" && styles.typeButtonSelected,
                  ]}
                  onPress={() => setEditedType("in")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      editedType === "in" && styles.typeButtonTextSelected,
                    ]}
                  >
                    IN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editedType === "out" && styles.typeButtonSelected,
                  ]}
                  onPress={() => setEditedType("out")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      editedType === "out" && styles.typeButtonTextSelected,
                    ]}
                  >
                    OUT
                  </Text>
                </TouchableOpacity>
              </View>
              <Button title="Save" onPress={handleUpdatePunch} />
              <Button
                title="Cancel"
                onPress={() => {
                  setIsEditModalVisible(false);
                  setEditingPunch(null);
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity style={styles.emailButton} onPress={sendEmail}>
        <Text style={styles.emailButtonText}>Email Report</Text>
      </TouchableOpacity>

      <SectionList
        sections={summaries}
        renderItem={renderSummaryItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>Time Summary</Text>
          </View>
        }
        ListFooterComponent={
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Punch History</Text>
            </View>
            <FlatList
              data={punches}
              renderItem={renderPunchItem}
              keyExtractor={(item) => item.timestamp}
              scrollEnabled={false}
            />
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No punch history available</Text>
        }
      />
      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>Reset All Data</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  listHeader: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  listHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212529",
  },
  sectionHeader: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#495057",
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#495057",
  },
  summaryHours: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
  },
  punchItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  punchInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  punchType: {
    fontSize: 16,
    fontWeight: "bold",
  },
  punchTime: {
    fontSize: 14,
    color: "#666",
  },
  emailButton: {
    backgroundColor: "#007AFF",
    margin: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  emailButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    marginTop: 32,
    padding: 16,
  },
  resetButton: {
    backgroundColor: "#ff4444",
    margin: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    width: 200,
    textAlign: "center",
  },
  typeSelectorContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1,
    marginHorizontal: 5,
    borderRadius: 5,
  },
  typeButtonSelected: {
    backgroundColor: "#007bff",
  },
  typeButtonText: {
    color: "#007bff",
  },
  typeButtonTextSelected: {
    color: "#fff",
  },
  timeInputContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  timeInput: {
    flex: 1,
    padding: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    marginHorizontal: 5,
    borderRadius: 5,
  },
  timeSeparator: {
    padding: 10,
  },
  dateInputContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    padding: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    marginHorizontal: 5,
    borderRadius: 5,
  },
  yearInput: {
    width: 80,
  },
  monthDayInput: {
    width: 40,
  },
  dateSeparator: {
    padding: 10,
  },
  modalLabel: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
});
