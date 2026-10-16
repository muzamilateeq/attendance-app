import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';

export type User = {
  id: string;
  email: string;
  device_id?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<'NEEDS_REGISTRATION' | 'SUCCESS' | void>;
  register: (email: string, fullName: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    // We intentionally don't load the user from AsyncStorage anymore
    // so that the user is forced to log in every time the app opens.
    setIsLoading(false);
  };

  const getDeviceId = async () => {
    let deviceId = await SecureStore.getItemAsync('secure_device_id');
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await SecureStore.setItemAsync('secure_device_id', deviceId);
    }
    return deviceId;
  };

  const login = async (rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase();
    try {
      const deviceId = await getDeviceId();
      const currentHardwareVersion = `OS: ${Device.osName} ${Device.osVersion}, Build: ${Device.osBuildId}, Design: ${Device.designName}, Product: ${Device.productName}`.trim();

      let phoneBinding = null;

      // 2. Query Supabase to see if this specific phone is registered (By Exact UUID)
      const { data: exactMatch } = await supabase
        .from('device_bindings')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (exactMatch) {
        phoneBinding = exactMatch;
      } else {
        // If UUID is not found, check if it's the exact same hardware (App reinstall scenario)
        const { data: hardwareMatches } = await supabase
          .from('device_bindings')
          .select('*')
          .eq('hardware_version', currentHardwareVersion)
          .limit(1);
          
        if (hardwareMatches && hardwareMatches.length > 0) {
          phoneBinding = hardwareMatches[0];
          
          // The user reinstalled the app and generated a new UUID, but the hardware matches.
          // Update the DB with the new UUID to restore their session seamlessly.
          await supabase.from('device_bindings').update({ device_id: deviceId }).eq('email', phoneBinding.email);
        }
      }

      if (phoneBinding) {
        // This phone is registered in Supabase. Does it belong to this email?
        // We use trim().toLowerCase() on the Supabase data in case the Admin accidentally added a space or capital letter!
        if (phoneBinding.email?.trim().toLowerCase() !== email) {
          Alert.alert(
            "Access Denied",
            `This physical phone is currently locked to another email. Please use your registered device or ask the Admin to clear the lock.`
          );
          return;
        }
        // It belongs to them! Login proceeds.
      } else {
        // This phone is not registered yet. 
        // 3. Query Supabase to see if this email is already registered to a DIFFERENT phone
        // We use ilike to be case-insensitive
        const { data: emailBinding, error: emailFetchError } = await supabase
          .from('device_bindings')
          .select('*')
          .ilike('email', email)
          .single();

        if (emailBinding) {
          Alert.alert(
            "Access Denied",
            "Your email is registered to another mobile device. Please use your original device or ask the Admin to clear the lock."
          );
          return;
        }
      }

      // 4. Now that device checks passed, check if they exist in employee_profiles
      const { data: profile, error: profileError } = await supabase
        .from('employee_profiles')
        .select('*')
        .ilike('email', email)
        .single();

      if (!profile) {
        if (profileError && profileError.code !== 'PGRST116') {
          console.warn("Supabase profile error:", profileError);
        }
        return 'NEEDS_REGISTRATION';
      }

      // 5. If they passed all checks and are not bound yet, create the binding!
      if (!phoneBinding) {
        const phoneModel = `${Device.deviceName || 'Unknown Name'} (${Device.brand || 'Unknown'} ${Device.modelName || 'Device'})`.trim();

        const { error: insertError } = await supabase
          .from('device_bindings')
          .insert([{ email, device_id: deviceId, phone_model: phoneModel, hardware_version: currentHardwareVersion }]);

        if (insertError) {
          console.log('Falling back to local mock due to Supabase error:', insertError);
        }
      }

      // 6. Login successful!
      const loggedInUser: User = { id: email, email };
      await AsyncStorage.setItem('@user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return 'SUCCESS';

    } catch (error: any) {
      Alert.alert("Login Error", error.message);
    }
  };

  const register = async (rawEmail: string, fullName: string, phone: string) => {
    const email = rawEmail.trim().toLowerCase();
    try {
      const { error } = await supabase
        .from('employee_profiles')
        .insert([{ email, full_name: fullName.trim(), phone_number: phone.trim() }]);

      if (error) {
        Alert.alert("Registration Error", error.message);
        return;
      }

      // Registration successful, proceed to device binding and login
      await login(email);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('@user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
