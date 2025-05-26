import * as Clipboard from "expo-clipboard";
import * as MailComposer from "expo-mail-composer";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Punch, deletePunch, loadPunches } from "../../storage/punchStorage";
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

  useEffect(() => {
    loadPunchData();
  }, []);

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

  const handleDeletePunch = async (timestamp: string) => {
    try {
      await deletePunch(timestamp);
      await loadPunchData();
      Alert.alert("Success", "Punch deleted successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to delete punch");
    }
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
});
