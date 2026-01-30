// Supabase-based notifications store
import { supabase } from './supabase';

export type NotificationType = "LIKE" | "GRADE" | "CONTEST_WIN";

export interface Notification {
  id: string;
  userEmail: string; // recipient
  actorEmail: string; // who caused it (could equal userEmail for system events)
  type: NotificationType;
  message: string;
  createdAt: string;
  read: boolean;
}

function dbToNotification(dbRow: any): Notification {
  const validTypes: NotificationType[] = ['LIKE', 'GRADE', 'CONTEST_WIN'];
  const type = validTypes.includes(dbRow.type) ? dbRow.type : 'LIKE';
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

export async function addNotification(userEmail: string, actorEmail: string, type: NotificationType, message: string): Promise<Notification> {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  const rowWithType = {
    id: notifId,
    user_email: userEmail,
    message,
    read: false,
    type,
  };
  let result = await supabase
    .from('notifications')
    .insert([rowWithType])
    .select()
    .single();

  if (result.error && /column.*type.*does not exist/i.test(String(result.error.message))) {
    const { type: _t, ...rowWithoutType } = rowWithType;
    result = await supabase.from('notifications').insert([rowWithoutType]).select().single();
  }
  if (result.error) {
    console.error('Error creating notification:', result.error);
    throw result.error;
  }
  const data = result.data;

  return {
    id: data.id,
    userEmail,
    actorEmail,
    type,
    message,
    createdAt: data.created_at,
    read: false,
  };
}

export async function getUserNotifications(userEmail: string, limit: number = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  
  return data.map(dbToNotification);
}

export async function markAllNotificationsRead(userEmail: string): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_email', userEmail)
    .eq('read', false)
    .select();

  if (error || !data) return 0;
  
  return data.length;
}

export async function clearAllNotifications(userEmail: string): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_email', userEmail)
    .select();

  if (error || !data) return 0;
  
  return data.length;
}

export async function getUnreadCount(userEmail: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('read', false);

  if (error) return 0;
  
  return count || 0;
}
