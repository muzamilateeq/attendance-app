import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { X, MessageSquare, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onRead: () => void;
}

type ReportedIssue = {
  id: string;
  issue_type: string;
  details: string;
  admin_reply: string | null;
  status: string;
  created_at: string;
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose, onRead }) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<ReportedIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && user) {
      fetchNotifications();
    }
  }, [visible, user]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // 1. Fetch the issues
      const { data, error } = await supabase
        .from('reported_issues')
        .select('*')
        .eq('email', user?.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setIssues(data);
      }

      // 2. Mark any unread replies as read
      const unreadIssues = data?.filter(i => i.admin_reply && !i.is_read) || [];
      if (unreadIssues.length > 0) {
        await supabase
          .from('reported_issues')
          .update({ is_read: true })
          .in('id', unreadIssues.map(i => i.id));
        
        // Notify the dashboard to clear the red dot
        onRead();
      }

    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color="#45464d" size={24} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#0051d5" size="large" />
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {issues.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MessageSquare color="#c6c6cd" size={48} />
                  <Text style={styles.emptyText}>You have no notifications yet.</Text>
                </View>
              ) : (
                issues.map(issue => (
                  <View key={issue.id} style={styles.issueCard}>
                    <View style={styles.issueHeader}>
                      <Text style={styles.issueType}>{issue.issue_type}</Text>
                      <Text style={[
                        styles.issueStatus,
                        { color: issue.status === 'RESOLVED' ? '#16A34A' : '#ba1a1a' }
                      ]}>
                        {issue.status}
                      </Text>
                    </View>
                    
                    <Text style={styles.dateText}>
                      Submitted on {format(new Date(issue.created_at), 'MMM dd, yyyy')}
                    </Text>

                    {issue.details ? (
                      <View style={styles.myMessageBubble}>
                        <Text style={styles.myMessageText}>"{issue.details}"</Text>
                      </View>
                    ) : null}

                    {issue.admin_reply ? (
                      <View style={styles.adminReplyBubble}>
                        <View style={styles.adminReplyHeader}>
                          <CheckCircle2 color="#0051d5" size={14} style={{marginRight: 4}} />
                          <Text style={styles.adminReplyTitle}>Admin Reply</Text>
                        </View>
                        <Text style={styles.adminReplyText}>{issue.admin_reply}</Text>
                      </View>
                    ) : (
                      <Text style={styles.waitingText}>Waiting for admin review...</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
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
    backgroundColor: '#f8f9ff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    height: '85%',
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#76777d',
    fontWeight: '500',
  },
  issueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e3e5',
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  issueType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b1c30',
    flex: 1,
  },
  issueStatus: {
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 12,
    color: '#76777d',
    marginBottom: 12,
  },
  myMessageBubble: {
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 12,
    borderBottomRightRadius: 2,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginBottom: 12,
  },
  myMessageText: {
    fontSize: 14,
    color: '#45464d',
    fontStyle: 'italic',
  },
  adminReplyBubble: {
    backgroundColor: '#eff4ff',
    padding: 12,
    borderRadius: 12,
    borderBottomLeftRadius: 2,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#d3e4fe',
  },
  adminReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminReplyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0051d5',
  },
  adminReplyText: {
    fontSize: 15,
    color: '#0b1c30',
    fontWeight: '500',
  },
  waitingText: {
    fontSize: 12,
    color: '#c6c6cd',
    fontStyle: 'italic',
    marginTop: 8,
  }
});
