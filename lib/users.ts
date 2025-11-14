// Supabase-based user storage
import { supabase } from './supabase';

export type User = {
  email: string;
  name?: string;
  nickname?: string; // Display name
  bio?: string; // User bio
  avatarUrl?: string; // Profile picture (Base64 or URL)
  avatarColor?: string; // Avatar background color
  role: "student" | "teacher";
  experience: number; // XP points
};

// Database column names use snake_case, convert to/from camelCase
function dbToUser(dbRow: any): User {
  return {
    email: dbRow.email,
    name: dbRow.name,
    nickname: dbRow.nickname,
    bio: dbRow.bio,
    avatarUrl: dbRow.avatar_url,
    avatarColor: dbRow.avatar_color,
    role: dbRow.role,
    experience: dbRow.experience || 0,
  };
}

function userToDb(user: Partial<User>): any {
  const dbObj: any = {};
  if (user.email !== undefined) dbObj.email = user.email;
  if (user.name !== undefined) dbObj.name = user.name;
  if (user.nickname !== undefined) dbObj.nickname = user.nickname;
  if (user.bio !== undefined) dbObj.bio = user.bio;
  if (user.avatarUrl !== undefined) dbObj.avatar_url = user.avatarUrl;
  if (user.avatarColor !== undefined) dbObj.avatar_color = user.avatarColor;
  if (user.role !== undefined) dbObj.role = user.role;
  if (user.experience !== undefined) dbObj.experience = user.experience;
  return dbObj;
}

export async function getOrCreateUser(email: string, name?: string, role: "student" | "teacher" = "student"): Promise<User> {
  // Try to get existing user
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (existing) {
    return dbToUser(existing);
  }

  // Create new user
  const newUser: User = {
    email,
    name,
    role,
    experience: 0,
    avatarColor: '#6366f1',
  };

  const { data, error } = await supabase
    .from('users')
    .insert([userToDb(newUser)])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return dbToUser(data);
}

export async function getUser(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return null;
  return dbToUser(data);
}

export async function updateUser(email: string, updates: Partial<Omit<User, 'email' | 'role'>>): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .update(userToDb(updates))
    .eq('email', email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating user:', error);
    return null;
  }

  return dbToUser(data);
}

export async function addExperience(email: string, points: number): Promise<User | null> {
  const user = await getUser(email);
  if (!user) return null;

  const newExp = user.experience + points;

  const { data, error } = await supabase
    .from('users')
    .update({ experience: newExp })
    .eq('email', email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error adding experience:', error);
    return null;
  }

  return dbToUser(data);
}

export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('experience', { ascending: false });

  if (error || !data) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data.map(dbToUser);
}

export async function getLeaderboard(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .order('experience', { ascending: false });

  if (error || !data) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data.map(dbToUser);
}
