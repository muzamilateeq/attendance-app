import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Platform, StatusBar, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { format } from 'date-fns';
import { Clock, Briefcase, CalendarDays, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type DailyRecord = {
  id: string;
  date_str: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: string | null;
};

export const HistoryScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonthStr, setCurrentMonthStr] = useState(format(new Date(), 'MMMM yyyy'));

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [user])
  );

  const fetchHistory = async () => {
    if (!user) return;
    try {
      // Fetching from the NEW clean table
      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('email', user.email)
        .order('date_str', { ascending: false });

      if (error) throw error;
      if (data) {
        setRecords(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Calculate marked dates for the Calendar
  const markedDates = useMemo(() => {
    const marks: any = {};
    records.forEach(record => {
      marks[record.date_str] = { marked: true, dotColor: '#0051d5' };
    });
    
    // Highlight selected date
    if (marks[selectedDate]) {
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#0051d5' };
    } else {
      marks[selectedDate] = { selected: true, selectedColor: '#0051d5' };
    }
    
    return marks;
  }, [records, selectedDate]);

  // 2. Calculate Month Summary
  const monthSummary = useMemo(() => {
    // Count how many records match the current month
    const totalDays = records.filter(record => {
      const recMonthStr = format(new Date(record.date_str), 'MMMM yyyy');
      return recMonthStr === currentMonthStr;
    }).length;

    return { totalDays };
  }, [records, currentMonthStr]);

  // 3. Find specific selected day record
  const selectedRecord = useMemo(() => {
    return records.find(r => r.date_str === selectedDate) || null;
  }, [records, selectedDate]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0051d5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. The Visual Calendar */}
        <View style={styles.calendarWrapper}>
          <Calendar
            current={selectedDate}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            onMonthChange={(month: any) => setCurrentMonthStr(format(new Date(month.dateString), 'MMMM yyyy'))}
            markedDates={markedDates}
            theme={{
              todayTextColor: '#0051d5',
              arrowColor: '#0051d5',
              dotColor: '#0051d5',
              selectedDayBackgroundColor: '#0051d5',
              textDayFontWeight: '600',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              monthTextColor: '#0b1c30',
            }}
          />
        </View>

        {/* 2. Month Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <CalendarDays color="#0051d5" size={24} />
          </View>
          <View style={styles.summaryTexts}>
            <Text style={styles.summaryTitle}>{currentMonthStr} Summary</Text>
            <Text style={styles.summaryValue}>
              <Text style={{fontWeight: '800', color: '#0b1c30'}}>{monthSummary.totalDays}</Text> Days Present
            </Text>
          </View>
        </View>

        {/* 3. Daily Details */}
        <Text style={styles.sectionTitle}>
          Details for {format(new Date(selectedDate), 'MMM dd, yyyy')}
        </Text>

        {!selectedRecord ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No attendance recorded on this date.</Text>
          </View>
        ) : (
          <View style={styles.detailsCard}>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <CheckCircle2 color="#16A34A" size={20} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.detailLabel}>Checked In</Text>
                <Text style={styles.detailValue}>{selectedRecord.check_in_time || '--:--'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={[styles.detailIconBox, { backgroundColor: '#ffeceb' }]}>
                <Briefcase color="#ba1a1a" size={20} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.detailLabel}>Checked Out</Text>
                <Text style={styles.detailValue}>{selectedRecord.check_out_time || 'Working...'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={[styles.detailIconBox, { backgroundColor: '#f0f4ff' }]}>
                <Clock color="#0051d5" size={20} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.detailLabel}>Total Hours</Text>
                <Text style={[styles.detailValue, { color: '#0051d5', fontWeight: '800' }]}>
                  {selectedRecord.total_hours || 'Calculating...'}
                </Text>
              </View>
            </View>

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e3e5',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  calendarWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c6c6cd',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0051d5',
    marginBottom: 24,
    shadowColor: '#0051d5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryTexts: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#45464d',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    color: '#45464d',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0b1c30',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e3e5',
    alignItems: 'center',
  },
  emptyText: {
    color: '#76777d',
    fontSize: 16,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c6c6cd',
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#76777d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b1c30',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e3e5',
    marginVertical: 12,
  }
});
