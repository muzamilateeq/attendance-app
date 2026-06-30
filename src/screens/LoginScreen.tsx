import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Briefcase, ArrowRight, HelpCircle } from 'lucide-react-native';
import { ReportIssueModal } from '../components/ReportIssueModal';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const { login, register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAction = async () => {
    if (!email.trim()) return;
    
    if (isRegistering) {
      if (!fullName.trim() || !phone.trim()) {
        alert("Please fill out all fields.");
        return;
      }
      setIsLoading(true);
      try {
        await register(email.trim(), fullName, phone);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const result = await login(email.trim());
        if (result === 'NEEDS_REGISTRATION') {
          setIsRegistering(true);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.iconWrapper}>
                <Briefcase color="#ffffff" size={40} />
              </View>
              <Text style={styles.title}>{isRegistering ? 'Complete Setup' : 'Welcome Back'}</Text>
              <Text style={styles.subtitle}>
                {isRegistering 
                  ? 'We need a few details since this is your first time.' 
                  : 'Enter your email to access your dashboard'}
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor="#76777d"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setIsRegistering(false);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                importantForAutofill="no"
                textContentType="none"
                editable={!isLoading && !isRegistering}
              />

              {isRegistering && (
                <>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor="#76777d"
                    value={fullName}
                    onChangeText={setFullName}
                    editable={!isLoading}
                  />

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor="#76777d"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                  />
                </>
              )}

              <TouchableOpacity 
                style={[
                  styles.button, 
                  (!email || (isRegistering && (!fullName || !phone)) || isLoading) && styles.buttonDisabled
                ]}
                onPress={handleAction}
                disabled={!email || (isRegistering && (!fullName || !phone)) || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>{isRegistering ? 'Complete Registration' : 'Sign In'}</Text>
                    <ArrowRight color="#ffffff" size={20} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.helpButton}
                onPress={() => setIsReportModalVisible(true)}
              >
                <HelpCircle color="#76777d" size={16} style={{marginRight: 6}} />
                <Text style={styles.helpText}>Need Help? Report Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ReportIssueModal 
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#0051d5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#0051d5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#76777d',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b1c30',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#e0e3e5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0051d5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#a3c2f0',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  helpButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  helpText: {
    color: '#76777d',
    fontSize: 14,
    fontWeight: '600',
  }
});
