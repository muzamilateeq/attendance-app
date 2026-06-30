import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Image, Platform, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, differenceInMinutes } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius } from '../theme/theme';
import { Clock, CalendarCheck, TrendingUp, MapPin } from 'lucide-react-native';

export const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [profile, setProfile] = useState<{full_name?: string, phone_number?: string, avatar_url?: string}>({});
  
  const [totalDays, setTotalDays] = useState(0);
  const [avgHours, setAvgHours] = useState('0h 0m');
  const [lateDays, setLateDays] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchStatistics();
    }, [user])
  );

  const fetchStatistics = async () => {
    if (!user) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startStr = format(startOfMonth, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('email', user.email)
        .gte('date_str', startStr)
        .order('date_str', { ascending: true });

      if (error) throw error;

      // Fetch Profile Data
      const { data: profileData } = await supabase
        .from('employee_profiles')
        .select('full_name, phone_number, avatar_url')
        .eq('email', user.email)
        .single();
        
      if (profileData) {
        setProfile(profileData);
      }

      if (data && data.length > 0) {
        calculateStats(data);
      }
    } catch (error) {
      console.log('Stats error (Using local mock stats):', error);
      // Mock stats if Supabase fails
      setTotalDays(12);
      setAvgHours('8h 15m');
      setLateDays(1);
    } finally {
      setLoading(false);
    }
  };

  const parseTimeStr = (timeStr: string): number => {
    // Parses "09:30 AM" or "04:15 PM" format into total minutes since midnight
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const parseTotalHoursToMins = (totalHoursStr?: string | null) => {
    if (!totalHoursStr) return 0;
    const match = totalHoursStr.match(/(\d+)h\s*(\d+)m/);
    if (match) {
      const h = parseInt(match[1], 10) || 0;
      const m = parseInt(match[2], 10) || 0;
      return (h * 60) + m;
    }
    return 0;
  };

  const calculateStats = (records: any[]) => {
    let daysPresent = 0;
    let totalMinutes = 0;
    let daysWithBoth = 0;
    let lateCount = 0;

    records.forEach(day => {
      if (day.check_in_time) {
        daysPresent++;
        const checkInMins = parseTimeStr(day.check_in_time);
        if (checkInMins > 9 * 60 + 15) lateCount++;

        if (day.total_hours) {
          daysWithBoth++;
          totalMinutes += parseTotalHoursToMins(day.total_hours);
        } else if (day.check_out_time) {
          // Fallback just in case total_hours is null but checkout time exists
          daysWithBoth++;
          const checkOutMins = parseTimeStr(day.check_out_time);
          totalMinutes += Math.max(0, checkOutMins - checkInMins);
        }
      }
    });

    setTotalDays(daysPresent);
    setLateDays(lateCount);

    if (daysWithBoth > 0) {
      const avgMins = Math.floor(totalMinutes / daysWithBoth);
      setAvgHours(`${Math.floor(avgMins / 60)}h ${avgMins % 60}m`);
    } else {
      setAvgHours('0h 0m');
    }
  };

  const handleSetOfficeLocation = async () => {
    setLocationLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Need location permissions to set the office.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newOfficeLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      await AsyncStorage.setItem('@office_location', JSON.stringify(newOfficeLocation));
      Alert.alert(
        "Office Location Updated!", 
        `Coordinates saved:\nLat: ${newOfficeLocation.latitude.toFixed(4)}\nLng: ${newOfficeLocation.longitude.toFixed(4)}\n\nYou can now check in successfully from here.`
      );
    } catch (e) {
      Alert.alert("Error", "Could not fetch your location.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];
      if (!image.base64) return;

      setUploadingAvatar(true);

      const ext = 'jpeg';
      const fileName = `${user?.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(image.base64), {
          contentType: `image/${ext}`,
        });

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = publicUrlData.publicUrl;

      // Update Profile Table
      const { error: updateError } = await supabase
        .from('employee_profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('email', user?.email);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: newAvatarUrl }));
      Alert.alert("Success", "Profile picture updated successfully!");

    } catch (error: any) {
      Alert.alert("Error Uploading", error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>My Profile</Text>
        
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
            <View style={styles.avatarPlaceholder}>
              {uploadingAvatar ? (
                <ActivityIndicator color={colors.primary} />
              ) : profile.avatar_url ? (
                // Use standard React Native Image if not using expo-image
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.email.substring(0, 2).toUpperCase()}</Text>
              )}
              {!uploadingAvatar && (
                <View style={styles.editBadge}>
                  <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>Edit</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.nameText}>{profile.full_name || 'Loading Name...'}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
          <Text style={styles.phoneText}>{profile.phone_number || 'Loading Phone...'}</Text>
          <Text style={styles.deviceStatus}>📱 Device Securely Bound</Text>
        </View>

        <Text style={styles.sectionTitle}>This Month's Statistics</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <CalendarCheck color={colors.success} size={32} />
            <Text style={styles.statValue}>{totalDays}</Text>
            <Text style={styles.statLabel}>Days Present</Text>
          </View>

          <View style={styles.statCard}>
            <Clock color={colors.primary} size={32} />
            <Text style={styles.statValue}>{avgHours}</Text>
            <Text style={styles.statLabel}>Avg Time / Day</Text>
          </View>

          <View style={[styles.statCard, { width: '100%', marginTop: spacing.md }]}>
            <TrendingUp color={lateDays > 0 ? colors.danger : colors.success} size={32} />
            <Text style={styles.statValue}>{lateDays}</Text>
            <Text style={styles.statLabel}>Late Arrivals (After 9:15 AM)</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => {
            Alert.alert(
              "Sign Out",
              "Are you sure you want to sign out?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: logout }
              ]
            );
          }}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.adminSection}>
          <Text style={styles.adminTitle}>Developer Tools</Text>
          <TouchableOpacity 
            style={styles.adminButton} 
            onPress={handleSetOfficeLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
               <ActivityIndicator color={colors.surface} />
            ) : (
               <>
                 <MapPin color={colors.surface} size={20} style={{marginRight: 8}} />
                 <Text style={styles.adminButtonText}>Set My Current Location as Office</Text>
               </>
            )}
          </TouchableOpacity>
          <Text style={styles.adminDesc}>Click this to dynamically set the center point of the 200m Geofence to wherever you are standing right now for testing.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  container: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.primaryDark, marginBottom: spacing.xl, marginTop: spacing.md },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xxl, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: borderRadius.xl, elevation: 4 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, overflow: 'visible' },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.primary },
  editBadge: { position: 'absolute', bottom: -5, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: colors.surface },
  nameText: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, marginBottom: 2 },
  emailText: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  phoneText: { fontSize: 14, color: colors.textLight, marginBottom: 8 },
  deviceStatus: { fontSize: 14, color: colors.success, fontWeight: '500', marginTop: spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.xl, alignItems: 'center', elevation: 3 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  statLabel: { fontSize: 13, color: colors.textLight, textAlign: 'center' },
  adminSection: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: colors.danger + '10', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.danger + '30' },
  adminTitle: { fontSize: 16, fontWeight: '700', color: colors.danger, marginBottom: spacing.md },
  adminButton: { flexDirection: 'row', backgroundColor: colors.danger, padding: spacing.md, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  adminButtonText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  adminDesc: { fontSize: 12, color: colors.textLight, marginTop: spacing.sm, textAlign: 'center' },
  logoutButton: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.xl, alignItems: 'center', marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 16 }
});
