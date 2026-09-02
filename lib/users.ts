// Supabase-based user storage
import { supabase } from './supabase';
import bcrypt from 'bcryptjs';
import { invalidateServerCache } from './serverCache';

export type User = {

  email: string;
  password?: string; // Hashed password
  name?: string;
  nickname?: string; // Display name
  bio?: string; // User bio
  avatarUrl?: string; // Profile picture (Base64 or URL)
  avatarColor?: string; // Avatar background color
  role: "student" | "teacher";
  grade?: string; // Student grade: "10", "11", "12", or "Р"
  experience: number; // XP points
};

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Database column names use snake_case, convert to/from camelCase
function dbToUser(dbRow: any): User {
  return {
    email: dbRow.email,
    password: dbRow.password,
    name: dbRow.name,
    nickname: dbRow.nickname,
    bio: dbRow.bio,
    avatarUrl: dbRow.avatar_url,
    avatarColor: dbRow.avatar_color,
    role: dbRow.role,
    grade: dbRow.grade,
    experience: dbRow.experience || 0,
  };
}

// Cache whether 'grade' column exists (Supabase prod may lag migrations)
let cachedSupportsGrade: boolean | null = null;
async function supportsGradeColumn(): Promise<boolean> {
  if (cachedSupportsGrade !== null) return cachedSupportsGrade;
  // Try selecting the column; if it errors, column is missing
  const { error } = await supabase.from('users').select('grade').limit(1);
  if (error && typeof error.message === 'string' && /column .*grade.* does not exist/i.test(error.message)) {
    cachedSupportsGrade = false;
  } else {
    cachedSupportsGrade = true;
  }
  return cachedSupportsGrade;
}

function userToDb(user: Partial<User>, opts: { includeGrade?: boolean } = {}): any {
  const includeGrade = opts.includeGrade !== undefined ? opts.includeGrade : true;
  const dbObj: any = {};
  if (user.email !== undefined) dbObj.email = user.email;
    if (user.password !== undefined) dbObj.password = user.password;
  if (user.name !== undefined) dbObj.name = user.name;
  if (user.nickname !== undefined) dbObj.nickname = user.nickname;
  if (user.bio !== undefined) dbObj.bio = user.bio;
  if (user.avatarUrl !== undefined) dbObj.avatar_url = user.avatarUrl;
  if (user.avatarColor !== undefined) dbObj.avatar_color = user.avatarColor;
  if (user.role !== undefined) dbObj.role = user.role;
  if (includeGrade && user.grade !== undefined) dbObj.grade = user.grade;
  if (user.experience !== undefined) dbObj.experience = user.experience;
  return dbObj;
}

// Create a new user (signup)
export async function createUser(email: string, password: string, name?: string, role: "student" | "teacher" = "student", grade?: string): Promise<User> {
  // Normalize email to lowercase for case-insensitive storage
  const normalizedEmail = normalizeEmail(email);
  // Check if user already exists
  const existing = await getUser(normalizedEmail);
  const hashedPassword = await bcrypt.hash(password, 10);
  const includeGrade = await supportsGradeColumn();

  if (existing) {
    // Migration-friendly: if existing user has no password yet, set it now and update optional fields
    if (!existing.password || existing.password.length === 0) {
      const { data, error } = await supabase
        .from('users')
        .update(userToDb({ password: hashedPassword, name: name ?? existing.name, role: role ?? existing.role, grade: grade ?? existing.grade }, { includeGrade }))
        .eq('email', normalizedEmail)
        .select()
        .single();
      if (error || !data) {
        console.error('Error upgrading existing user with password:', error);
        throw error || new Error('Upgrade failed');
      }
      return dbToUser(data);
    }
    throw new Error('Email хаяг аль хэдийн бүртгэлтэй байна');
  }

  // Create new user
  const newUser: User = {
    email: normalizedEmail,
    password: hashedPassword,
    name,
    role,
    grade: role === "student" ? grade : undefined,
    experience: 0,
    avatarColor: '#6366f1',
  };

  const { data, error } = await supabase
    .from('users')
    .insert([userToDb(newUser, { includeGrade })])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return dbToUser(data);
}

// Verify user credentials (signin)
export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = await getUser(email);
  if (!user) return null;

  // Defensive: handle legacy users with no password or wrong type
  if (typeof user.password !== 'string' || user.password.length === 0) {
    return null;
  }

  try {
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
  } catch (e) {
    // bcrypt throws on invalid args (e.g., object/undefined). Treat as invalid credentials.
    return null;
  }

  return user;
}

// Reset user password
export async function resetUserPassword(email: string, newPassword: string): Promise<User> {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await getUser(normalizedEmail);
  if (!existingUser) {
    throw new Error("Ийм бүртгэлтэй хэрэглэгч олдсонгүй");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const { data, error } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('email', existingUser.email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error resetting user password:', error);
    throw new Error("Нууц үг шинэчлэхэд алдаа гарлаа");
  }

  return dbToUser(data);
}

export async function getUser(email: string): Promise<User | null> {
  // Normalize email to lowercase for case-insensitive comparison
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', normalizedEmail)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return dbToUser(data[0]);
}

export async function updateUser(email: string, updates: Partial<Omit<User, 'email' | 'role'>>): Promise<User | null> {
  const existingUser = await getUser(email);
  if (!existingUser) {
    return null;
  }

  const includeGrade = await supportsGradeColumn();
  const { data, error } = await supabase
    .from('users')
    .update(userToDb(updates as any, { includeGrade }))
    .eq('email', existingUser.email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating user:', error);
    return null;
  }

  invalidateServerCache(`user_info:${email.toLowerCase()}`);
  invalidateServerCache(`user_meta:${email.toLowerCase()}`);
  invalidateServerCache('leaderboard');
  return dbToUser(data);
}

export async function addExperience(email: string, points: number): Promise<User | null> {
  const user = await getUser(email);
  if (!user) return null;

  const newExp = user.experience + points;

  const { data, error } = await supabase
    .from('users')
    .update({ experience: newExp })
    .eq('email', user.email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error adding experience:', error);
    return null;
  }

  invalidateServerCache(`user_info:${email.toLowerCase()}`);
  invalidateServerCache('leaderboard');
  return dbToUser(data);
}

// Set exact XP amount (for teacher management)
export async function setExperience(email: string, points: number): Promise<User | null> {
  const user = await getUser(email);
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .update({ experience: Math.max(0, points) })
    .eq('email', user.email)
    .select()
    .single();

  if (error || !data) {
    console.error('Error setting experience:', error);
    return null;
  }

  invalidateServerCache(`user_info:${email.toLowerCase()}`);
  invalidateServerCache('leaderboard');
  return dbToUser(data);
}

export async function getAllUsers(limit: number = 100): Promise<User[]> {

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('experience', { ascending: false })
    .limit(limit);

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

// Lightweight leaderboard query selecting only necessary columns
export async function getLeaderboardLight(grade?: string, limit: number = 100): Promise<User[]> {
  let query = supabase
    .from('users')
    .select('email,name,nickname,avatar_url,avatar_color,role,grade,experience')
    .eq('role', 'student')
    .order('experience', { ascending: false })
    .limit(limit);

  if (grade && ['10','11','12'].includes(grade)) {
    query = query.eq('grade', grade);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching leaderboard (light):', error);
    return [];
  }

  return data.map(dbToUser);
}

// Ensure the AI assistant user exists for FK integrity on comments
export async function ensureAIUserExists(): Promise<void> {
  const email = 'ai-assistant';
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .single();

  if (data && !error) return; // exists

  // Create lightweight AI user without password
  const { error: insertError } = await supabase
    .from('users')
    .insert([
      {
        email,
        name: '🤖 AI Шүүмжлэгч',
        role: 'teacher',
        experience: 0,
      },
    ]);

  if (insertError) {
    // Log but don't throw to avoid blocking post creation
    console.error('Failed to create AI user:', insertError);
  }
}
