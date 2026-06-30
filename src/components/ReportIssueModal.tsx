import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { X, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ReportIssueModalProps {
  visible: boolean;
  onClose: () => void;
}

const ISSUE_OPTIONS = [
  'Request Email/Device Change',
  'GPS/Location not working',
  'App is crashing or buggy',
  'Other...'
];

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedIssue) {
      Alert.alert('Selection Required', 'Please select an issue type.');
      return;
    }

    const submitEmail = (user?.email || guestEmail).trim().toLowerCase();

    if (!submitEmail) {
      Alert.alert('Email Required', 'Please provide your email address so we can contact you.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('reported_issues').insert([{
        email: submitEmail,
        issue_type: selectedIssue,
        details: details,
      }]);

      if (error) throw error;

      Alert.alert(
        'Issue Reported Successfully', 
        'Your request has been submitted to the Admin team. We will review it shortly.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (e: any) {
      console.error('Error reporting issue:', e);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIssue(null);
    setDetails('');
    setGuestEmail('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Issue</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X color="#45464d" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            {!user && (
              <View style={{ marginBottom: 24 }}>
                <Text style={styles.label}>Your Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  placeholderTextColor="#76777d"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            <Text style={styles.label}>What are you experiencing?</Text>
            
            <View style={styles.optionsList}>
              {ISSUE_OPTIONS.filter(opt => !user || opt !== 'Request Email/Device Change').map((option) => {
                const isSelected = selectedIssue === option;
                return (
                  <TouchableOpacity 
                    key={option} 
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => setSelectedIssue(option)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option}
                    </Text>
                    {isSelected ? (
                      <CheckCircle2 color="#0051d5" size={20} />
                    ) : (
                      <ChevronRight color="#c6c6cd" size={20} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subtitle}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Please explain why you need this change or describe the issue..."
              placeholderTextColor="#c6c6cd"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={details}
              onChangeText={setDetails}
            />

            <TouchableOpacity 
              style={[styles.submitButton, (!selectedIssue || isSubmitting) && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={!selectedIssue || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
            
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b1c30',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#45464d',
    marginBottom: 12,
    marginTop: 8,
  },
  optionsList: {
    marginBottom: 24,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e3e5', // tertiary-fixed
    backgroundColor: '#ffffff',
  },
  optionRowSelected: {
    borderColor: '#0051d5',
    backgroundColor: '#eff4ff', // surface-container-low
  },
  optionText: {
    fontSize: 16,
    color: '#0b1c30', // on-surface
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#0051d5',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#c6c6cd',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#0b1c30',
    backgroundColor: '#f8f9ff',
    minHeight: 120,
    marginBottom: 32,
  },
  submitButton: {
    backgroundColor: '#0051d5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#c6c6cd',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  }
});
