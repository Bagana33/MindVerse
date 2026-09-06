// Supabase-based notifications store
import { supabase } from './supabase';
import { invalidateServerCache } from './serverCache';

export type NotificationType = "LIKE" | "GRADE" | "CONTEST_WIN" | "COMMENT" | "LESSON";

export interface Notification {
  id: string;
  userEmail: string; // recipient
  actorEmail: string; // who caused it (could equal userEmail for system events)
  type: NotificationType;
  message: string;
  createdAt: string;
  read: boolean;
}

function inferTypeFromMessage(message: string): NotificationType {
  const msg = message || '';
  if (msg.includes('💬') || msg.toLowerCase().includes('сэтгэгдэл')) return 'COMMENT';
  if (msg.includes('📝') || msg.includes('оноо') || msg.includes('үнэлгээ') || msg.includes('даалгавар') || msg.includes('шалгагч')) return 'GRADE';
  if (msg.includes('🏆') || msg.includes('яллаа') || msg.includes('Vote game') || msg.includes('🎉') || msg.includes('түрүүл')) return 'CONTEST_WIN';
  if (msg.includes('📚') || msg.includes('Шинэ хичээл')) return 'LESSON';
  return 'LIKE';
}

function dbToNotification(dbRow: any): Notification {
  const validTypes: NotificationType[] = ['LIKE', 'GRADE', 'CONTEST_WIN', 'COMMENT', 'LESSON'];
  let type: NotificationType = 'LIKE';
  if (dbRow.type && validTypes.includes(dbRow.type)) {
    type = dbRow.type;
  } else {
    type = inferTypeFromMessage(dbRow.message || '');
  }
  return {
    id: dbRow.id,
    userEmail: dbRow.user_email,
    actorEmail: dbRow.actor_email ?? dbRow.user_email,
    type,
    message: dbRow.message ?? '',
    createdAt: dbRow.created_at,
    read: Boolean(dbRow.read),
  };
}

export async function addNotification(
  userEmail: string,
  actorEmail: string,
  type: NotificationType,
  message: string
): Promise<Notification> {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const normalizedEmail = userEmail.toLowerCase().trim();
  
  // The notifications table in Supabase schema contains: id, user_email, message, read, created_at
  const payload = {
    id: notifId,
    user_email: normalizedEmail,
    message,
    read: false,
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  // Invalidate server cache so recipient gets instant real-time update
  invalidateServerCache(`notifs:${normalizedEmail}`);

  return {
    id: data.id,
    userEmail: normalizedEmail,
    actorEmail,
    type,
    message: data.message,
    createdAt: data.created_at,
    read: false,
  };
}

export async function addNotificationBatch(
  userEmails: string[],
  actorEmail: string,
  type: NotificationType,
  message: string
): Promise<void> {
  if (!userEmails || userEmails.length === 0) return;
  const uniqueEmails = [...new Set(userEmails.map(e => e.toLowerCase().trim()))];
  const rows = uniqueEmails.map(email => ({
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_email: email,
    message,
    read: false,
  }));

  try {
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      console.error('Error batch inserting notifications:', error);
    } else {
      uniqueEmails.forEach(email => {
        invalidateServerCache(`notifs:${email}`);
      });
    }
  } catch (err) {
    console.error('Error batch inserting notifications:', err);
  }
}

export async function getUserNotifications(userEmail: string, limit: number = 50): Promise<Notification[]> {
  const normalized = userEmail.toLowerCase().trim();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', normalized)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  
  return data.map(dbToNotification);
}

export async function markNotificationRead(id: string, userEmail: string): Promise<boolean> {
  const normalized = userEmail.toLowerCase().trim();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_email', normalized)
    .select();

  if (error || !data || data.length === 0) return false;
  invalidateServerCache(`notifs:${normalized}`);
  return true;
}

export async function markAllNotificationsRead(userEmail: string): Promise<number> {
  const normalized = userEmail.toLowerCase().trim();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_email', normalized)
    .eq('read', false)
    .select();

  if (error || !data) return 0;
  invalidateServerCache(`notifs:${normalized}`);
  return data.length;
}

export async function clearAllNotifications(userEmail: string): Promise<number> {
  const normalized = userEmail.toLowerCase().trim();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_email', normalized)
    .select();

  if (error || !data) return 0;
  invalidateServerCache(`notifs:${normalized}`);
  return data.length;
}

export async function getUnreadCount(userEmail: string): Promise<number> {
  const normalized = userEmail.toLowerCase().trim();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', normalized)
    .eq('read', false);

  if (error) return 0;
  
  return count || 0;
}
