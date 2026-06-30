import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ScrollView, Platform, StatusBar, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, Fingerprint, CalendarOff, CalendarDays, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import { LiveTimer } from '../components/LiveTimer';
import { ReportIssueModal } from '../components/ReportIssueModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

type Status = 'CHECKED_OUT' | 'CHECKED_IN';

const ALLOWED_RADIUS_METERS = 200;
const DEFAULT_OFFICE_LOCATION = { latitude: 51.5074, longitude: -0.1278 };

export const DashboardScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<Status>('CHECKED_OUT');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState('--:--');
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(null);
  const [todayTotalHours, setTodayTotalHours] = useState('0h 0m');
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadProfileAvatar = async () => {
        if (!user) return;
        try {
          const { data } = await supabase
            .from('employee_profiles')
            .select('avatar_url')
            .eq('email', user.email)
            .single();
          if (data?.avatar_url) {
            setAvatarUrl(data.avatar_url);
          }
        } catch (e) {
          console.error('Failed to load avatar', e);
        }
      };
      loadProfileAvatar();
    }, [user])
  );

  useEffect(() => {
    loadStatus();
    loadNotifications();
  }, []);

  const performAutoCheckout = async () => {
    if (!user || !checkInTimestamp || status !== 'CHECKED_IN') return;

    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const diff = Date.now() - checkInTimestamp;

    if (diff >= EIGHT_HOURS_MS) {
      const dateEmailKey = `${format(new Date(), 'yyyy-MM-dd')}_${user?.email}`;
      const currentTimeStr = format(new Date(), 'hh:mm a');

      const { error } = await supabase.from('daily_attendance')
        .update({
          check_out_time: currentTimeStr,
          total_hours: '8h 0m'
        })
        .eq('date_email_key', dateEmailKey);
      
      if (!error) {
        await AsyncStorage.setItem(`@status_${user?.email}`, 'CHECKED_OUT');
        await AsyncStorage.setItem(`@total_hours_${user?.email}`, '8h 0m');
        await AsyncStorage.removeItem(`@timestamp_${user?.email}`);
        setCheckInTimestamp(null);
        setTodayTotalHours('8h 0m');
        setStatus('CHECKED_OUT');
        Alert.alert('Auto Checkout', 'You have been automatically checked out after 8 hours of work.');
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'CHECKED_IN' && checkInTimestamp) {
      // Check immediately
      performAutoCheckout();
      
      // Then check every minute
      interval = setInterval(() => {
        performAutoCheckout();
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, checkInTimestamp]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reported_issues')
        .select('id')
        .eq('email', user.email)
        .not('admin_reply', 'is', null)
        .eq('is_read', false)
        .limit(1);
        
      if (!error && data && data.length > 0) {
        setHasUnreadNotifications(true);
      }
    } catch (e) {
      console.log('Error loading notifications', e);
    }
  };

  const loadStatus = async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const lastDate = await AsyncStorage.getItem(`@last_date_${user?.email}`);

      if (lastDate && lastDate !== todayStr) {
        // It's a new day! Reset the local state so the dashboard is fresh.
        // Yesterday's data is already safely stored in Supabase.
        await AsyncStorage.multiRemove([
          `@status_${user?.email}`,
          `@time_${user?.email}`,
          `@timestamp_${user?.email}`,
          `@total_hours_${user?.email}`
        ]);
        setStatus('CHECKED_OUT');
        setCheckInTime('--:--');
        setCheckInTimestamp(null);
        setTodayTotalHours('0h 0m');
      } else {
        const storedStatus = await AsyncStorage.getItem(`@status_${user?.email}`);
        if (storedStatus) {
          setStatus(storedStatus as Status);
        }
        const storedTime = await AsyncStorage.getItem(`@time_${user?.email}`);
        if (storedTime) {
          setCheckInTime(storedTime);
        }
        const storedTimestamp = await AsyncStorage.getItem(`@timestamp_${user?.email}`);
        if (storedTimestamp) {
          setCheckInTimestamp(parseInt(storedTimestamp, 10));
        }
        const storedTotal = await AsyncStorage.getItem(`@total_hours_${user?.email}`);
        if (storedTotal) {
          setTodayTotalHours(storedTotal);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getOfficeLocation = async () => {
    try {
      const savedLoc = await AsyncStorage.getItem('@office_location');
      if (savedLoc) return JSON.parse(savedLoc);
    } catch (e) {}
    return DEFAULT_OFFICE_LOCATION;
  };

  const verifyLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to mark attendance.');
      return false;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const officeLoc = await getOfficeLocation();
    const distance = getDistance(
      { latitude: location.coords.latitude, longitude: location.coords.longitude },
      officeLoc
    );

    if (distance > ALLOWED_RADIUS_METERS) {
      Alert.alert(
        'Out of Range', 
        `You are ${distance} meters away from the office. You must be within ${ALLOWED_RADIUS_METERS} meters to check in.\n\n(Tip: Go to the Profile tab to set the Office Location to your current spot for testing!)`
      );
      return false;
    }
    return location.coords;
  };

  const parseTotalHoursToMs = (totalHoursStr?: string | null) => {
    if (!totalHoursStr) return 0;
    const match = totalHoursStr.match(/(\d+)h\s*(\d+)m/);
    if (match) {
      const h = parseInt(match[1], 10) || 0;
      const m = parseInt(match[2], 10) || 0;
      return (h * 60 * 60 * 1000) + (m * 60 * 1000);
    }
    return 0;
  };

  const handleAction = async () => {
    setActionLoading(true);
    
    const coords = await verifyLocation();
    if (!coords) {
      setActionLoading(false);
      return;
    }

    const newStatus = status === 'CHECKED_IN' ? 'CHECKED_OUT' : 'CHECKED_IN';
    const currentTimeStr = format(new Date(), 'hh:mm a');
    const nowTimestamp = Date.now();
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const dateEmailKey = `${dateStr}_${user?.email}`;
    
    try {
      if (newStatus === 'CHECKED_IN') {
        const { data: existingRecord } = await supabase
          .from('daily_attendance')
          .select('*')
          .eq('date_email_key', dateEmailKey)
          .single();

        const accumulatedMs = parseTotalHoursToMs(existingRecord?.total_hours);
        const originalCheckInTime = existingRecord?.check_in_time || currentTimeStr;
        const effectiveStartTimestamp = nowTimestamp - accumulatedMs;

        const { error } = await supabase.from('daily_attendance').upsert([{
          email: user?.email,
          date_str: dateStr,
          date_email_key: dateEmailKey,
          check_in_time: originalCheckInTime,
          latitude: coords.latitude,
          longitude: coords.longitude,
          total_hours: existingRecord?.total_hours || null,
          check_out_time: existingRecord?.check_out_time || null
        }], { onConflict: 'date_email_key' });
        
        if (error) console.log('Supabase check-in failed:', error);

        await AsyncStorage.setItem(`@status_${user?.email}`, newStatus);
        await AsyncStorage.setItem(`@time_${user?.email}`, originalCheckInTime);
        await AsyncStorage.setItem(`@timestamp_${user?.email}`, effectiveStartTimestamp.toString());
        await AsyncStorage.setItem(`@last_date_${user?.email}`, dateStr);
        
        setCheckInTime(originalCheckInTime);
        setCheckInTimestamp(effectiveStartTimestamp);
        
      } else {
        // Checking out, calculate total hours
        const diff = nowTimestamp - (checkInTimestamp || nowTimestamp);
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const totalHours = `${h}h ${m}m`;

        const { error } = await supabase.from('daily_attendance')
          .update({
            check_out_time: currentTimeStr,
            total_hours: totalHours
          })
          .eq('date_email_key', dateEmailKey);
        
        if (error) console.log('Supabase check-out failed:', error);
        
        await AsyncStorage.setItem(`@status_${user?.email}`, newStatus);
        await AsyncStorage.setItem(`@total_hours_${user?.email}`, totalHours);
        await AsyncStorage.setItem(`@last_date_${user?.email}`, dateStr);
        
        // We preserve the time so they see their initial check-in time for today,
        // but we remove timestamp so LiveTimer stops.
        await AsyncStorage.removeItem(`@timestamp_${user?.email}`);
        setCheckInTimestamp(null);
        setTodayTotalHours(totalHours);
      }

      setStatus(newStatus);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update attendance');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickAction = (actionName: string) => {
    if (actionName === 'Report Issue') {
      setIsReportModalVisible(true);
    } else {
      Alert.alert('Coming Soon', `${actionName} will be available in the next update!`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#f8f9ff' }]}>
        <ActivityIndicator size="large" color="#0051d5" />
      </View>
    );
  }

  const currentDateStr = format(new Date(), 'EEEE, MMMM do');
  const userInitials = user?.email.substring(0, 2).toUpperCase() || 'U';
  
  const currentHour = new Date().getHours();
  let greeting = 'Good Evening!';
  if (currentHour < 12) {
    greeting = 'Good Morning!';
  } else if (currentHour < 17) {
    greeting = 'Good Afternoon!';
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Bar */}
      <View style={styles.topAppBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.avatar, { overflow: 'hidden' }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={styles.avatarText}>{userInitials}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Attendance</Text>
        </View>
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => setIsNotificationsVisible(true)}
        >
          <Bell color="#45464d" size={24} />
          {hasUnreadNotifications && (
            <View style={styles.notificationBadge} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Daily Status Card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <Text style={styles.dateText}>{currentDateStr}</Text>
            <Text style={styles.greetingText}>{greeting}</Text>
          </View>

          <View style={styles.statusDisplay}>
            <View style={styles.fingerprintContainer}>
              <View style={styles.fingerprintRing}>
                <Fingerprint size={48} color="#c6c6cd" />
              </View>
              {/* Pulsing Status Dot */}
              <View style={[
                styles.statusDot, 
                { backgroundColor: status === 'CHECKED_IN' ? '#16A34A' : '#ba1a1a' }
              ]} />
            </View>
            <Text style={styles.statusSubtitle}>
              {status === 'CHECKED_IN' ? `Working since ${checkInTime}` : 'Not checked in yet'}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.checkInButton, { backgroundColor: status === 'CHECKED_IN' ? '#0b1c30' : '#0051d5' }]}
            onPress={handleAction}
            activeOpacity={0.8}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.checkInButtonText}>
                {status === 'CHECKED_IN' ? 'Check Out' : 'Check In'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Daily Stats Bento */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoBox}>
            <Text style={styles.bentoLabel}>HOURS TODAY</Text>
            {status === 'CHECKED_IN' ? (
              <LiveTimer status={status} checkInTimestamp={checkInTimestamp} />
            ) : (
              <Text style={styles.bentoValue}>{todayTotalHours || '0h 0m'}</Text>
            )}
          </View>
          <View style={styles.bentoBox}>
            <Text style={styles.bentoLabel}>CHECK-IN</Text>
            <Text style={[styles.bentoValue, { color: status === 'CHECKED_IN' ? '#000000' : '#c6c6cd' }]}>
              {checkInTime}
            </Text>
          </View>
          <View style={styles.bentoBox}>
            <Text style={styles.bentoLabel}>NEXT BREAK</Text>
            <Text style={styles.bentoValue}>1:00 PM</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionRow} onPress={() => handleQuickAction('Request Leave')} activeOpacity={0.7}>
            <View style={[styles.actionIconBox, { backgroundColor: '#dae2fd' }]}>
              <CalendarOff color="#131b2e" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionRowTitle}>Request Leave</Text>
              <Text style={styles.actionRowDesc}>Apply for time off or sick leave</Text>
            </View>
            <ChevronRight color="#c6c6cd" size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => handleQuickAction('View Schedule')} activeOpacity={0.7}>
            <View style={[styles.actionIconBox, { backgroundColor: '#dbe1ff' }]}>
              <CalendarDays color="#00174b" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionRowTitle}>View Schedule</Text>
              <Text style={styles.actionRowDesc}>Check shift timing and location</Text>
            </View>
            <ChevronRight color="#c6c6cd" size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => handleQuickAction('Report Issue')} activeOpacity={0.7}>
            <View style={[styles.actionIconBox, { backgroundColor: '#ffdad6' }]}>
              <AlertTriangle color="#93000a" size={20} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionRowTitle}>Report Issue</Text>
              <Text style={styles.actionRowDesc}>Log attendance or GPS discrepancies</Text>
            </View>
            <ChevronRight color="#c6c6cd" size={24} />
          </TouchableOpacity>

        </View>

      </ScrollView>

      <ReportIssueModal 
        visible={isReportModalVisible} 
        onClose={() => setIsReportModalVisible(false)} 
      />

      <NotificationsModal 
        visible={isNotificationsVisible}
        onClose={() => setIsNotificationsVisible(false)}
        onRead={() => setHasUnreadNotifications(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9ff', // surface
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#ffffff', // surface-container-lowest
    borderBottomWidth: 1,
    borderBottomColor: '#c6c6cd', // outline-variant
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d3e4fe', // surface-container-highest
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0051d5',
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ba1a1a', // Red dot
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c6cd',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  mainCardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#45464d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  statusDisplay: {
    alignItems: 'center',
    marginBottom: 32,
  },
  fingerprintContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  fingerprintRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: '#e5eeff', // surface-container
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#45464d',
  },
  checkInButton: {
    width: '100%',
    maxWidth: 320,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0051d5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0051d5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  checkInButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  autoCheckoutInfo: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#e8f0fe',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c2d3fc',
  },
  autoCheckoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0051d5',
    marginBottom: 4,
  },
  autoCheckoutSubtitle: {
    fontSize: 13,
    color: '#45464d',
    textAlign: 'center',
  },
  bentoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  bentoBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c6c6cd',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#45464d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bentoValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  quickActionsContainer: {
    gap: 12,
  },
  quickActionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c6c6cd',
    borderRadius: 12,
    padding: 16,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionRowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b1c30',
  },
  actionRowDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#45464d',
  },
});
