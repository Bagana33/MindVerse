// Supabase-based post storage
import { supabase } from './supabase';

export type ReactionType = 'FIRE' | 'WOW' | 'LOVE' | 'COOL' | 'STAR';
export type PostReaction = { userEmail: string; type: ReactionType };
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  authorAvatarUrl?: string;
  authorAvatarColor?: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: PostReaction[]; // One reaction per user
  visibility: Visibility;
};

// Helper to convert DB format to UserPost
function dbToPost(
  dbRow: any, 
  reactions: any[], 
  authorName?: string,
  authorAvatarUrl?: string,
  authorAvatarColor?: string
): UserPost {
  // Calculate points based on reactions count (each reaction = 1 point)
  const reactionCount = reactions?.length || 0;
  return {
    id: dbRow.id,
    title: dbRow.title || dbRow.text, // Fallback to text for backward compatibility
    description: dbRow.description || dbRow.text,
    author: authorName || dbRow.author_email, // Use provided name or fallback to email
    authorEmail: dbRow.author_email,
    authorAvatarUrl,
    authorAvatarColor,
    points: reactionCount, // Points = number of reactions
    createdAt: dbRow.created_at,
    imageUrl: dbRow.image_data,
    reactions: reactions.map(r => ({ userEmail: r.user_email, type: r.type.toUpperCase() })),
    visibility: 'PUBLIC',
  };
}

export async function createPost(data: Omit<UserPost, "id" | "points" | "createdAt" | "reactions">): Promise<UserPost> {
  const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: inserted, error } = await supabase
    .from('posts')
    .insert([{
      id: postId,
      author_email: data.authorEmail,
      title: data.title,
      description: data.description,
      text: data.description, // Keep for backward compatibility
      image_data: data.imageUrl,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }

  return dbToPost(inserted, [], data.author, data.authorAvatarUrl, data.authorAvatarColor);
}

export async function getUserPosts(email: string): Promise<UserPost[]> {
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .eq('author_email', email)
    .order('created_at', { ascending: false });

  if (postsError || !posts) return [];

  // Get user info for author name & avatar
  const { data: user } = await supabase
    .from('users')
    .select('email, name, nickname, avatar_url, avatar_color')
    .eq('email', email)
    .single();

  // Get reactions for all posts
  const postIds = posts.map(p => p.id);
  const { data: reactions } = await supabase
    .from('reactions')
    .select('*')
    .in('post_id', postIds);

  const authorName = user?.nickname || user?.name || email;

  return posts.map(post => {
    const postReactions = reactions?.filter(r => r.post_id === post.id) || [];
    return dbToPost(post, postReactions, authorName, user?.avatar_url, user?.avatar_color);
  });
}

export async function getAllPosts(): Promise<UserPost[]> {
  // Keep for backward-compat; delegate to paginated fetch with default limit
  return getPostsPage(30);
}

// Paginated posts with optional cursor (created_at before), grade filter, and database search query
export async function getPostsPage(limit = 20, beforeISO?: string, grade?: string, search?: string): Promise<UserPost[]> {
  let posts: any[] = [];

  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeISO) {
    query = query.lt('created_at', beforeISO);
  }

  if (search && search.trim()) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,text.ilike.%${q}%,author_email.ilike.%${q}%`);
  }

  if (grade && grade !== 'all') {
    const { data: usersWithGrade, error: usersError } = await supabase
      .from('users')
      .select('email')
      .eq('grade', grade);
    if (usersError || !usersWithGrade?.length) return [];
    const authorEmails = usersWithGrade.map(u => u.email);
    query = query.in('author_email', authorEmails);
  }

  const { data: fetchedPosts, error: postsError } = await query;
  if (postsError || !fetchedPosts || fetchedPosts.length === 0) return [];
  posts = fetchedPosts;

  const authorEmails = [...new Set(posts.map(p => p.author_email))];
  const postIds = posts.map(p => p.id);

  // Fetch author details, reactions, and comments in parallel
  const [usersRes, reactionsRes] = await Promise.all([
    supabase
      .from('users')
      .select('email, name, nickname, grade, avatar_url, avatar_color')
      .in('email', authorEmails),
    supabase
      .from('reactions')
      .select('*')
      .in('post_id', postIds),
  ]);

  const userMap = new Map((usersRes.data || []).map((u: any) => [u.email, u]));
  const reactions = reactionsRes.data || [];

  return posts.map(post => {
    const postReactions = reactions.filter((r: any) => r.post_id === post.id);
    const user = userMap.get(post.author_email);
    const authorName = user?.nickname || user?.name || post.author_email;
    return dbToPost(post, postReactions, authorName, user?.avatar_url, user?.avatar_color);
  });
}


export async function deletePost(postId: string, userEmail: string): Promise<boolean> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_email', userEmail);

  return !error;
}

export async function toggleReactionWithType(
  postId: string, 
  userEmail: string, 
  type: ReactionType
): Promise<{ success: boolean; added: boolean; removed: boolean; updated: boolean }> {
  // Check existing reaction
  const { data: existing } = await supabase
    .from('reactions')
    .select('id, type')
    .eq('post_id', postId)
    .eq('user_email', userEmail)
    .maybeSingle();

  if (existing) {
    if (existing.type.toUpperCase() === type) {
      // Remove reaction
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('id', existing.id);
      
      if (error) return { success: false, added: false, removed: false, updated: false };
      return { success: true, added: false, removed: true, updated: false };
    } else {
      // Update reaction type
      const { error } = await supabase
        .from('reactions')
        .update({ type: type.toLowerCase() })
        .eq('id', existing.id);
      
      if (error) return { success: false, added: false, removed: false, updated: false };
      return { success: true, added: false, removed: false, updated: true };
    }
  } else {
    // Add new reaction
    const { error } = await supabase
      .from('reactions')
      .insert([{
        post_id: postId,
        user_email: userEmail,
        type: type.toLowerCase(),
      }]);
    
    if (error) return { success: false, added: false, removed: false, updated: false };
    return { success: true, added: true, removed: false, updated: false };
  }
}

export async function getPostMeta(postId: string): Promise<{ title: string; authorEmail: string } | null> {
  const { data: post, error } = await supabase
    .from('posts')
    .select('title, text, author_email')
    .eq('id', postId)
    .maybeSingle();

  if (error || !post) return null;

  return {
    title: post.title || post.text || 'Пост',
    authorEmail: post.author_email,
  };
}

export function getReactionCounts(post: UserPost) {
  return post.reactions.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<ReactionType, number>);
}

export function getUserReactionType(post: UserPost, userEmail: string): ReactionType | null {
  const r = post.reactions.find(re => re.userEmail === userEmail);
  return r ? r.type : null;
}

export async function getPost(postId: string): Promise<UserPost | null> {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) return null;

  // Get user info for author name & avatar
  const { data: user } = await supabase
    .from('users')
    .select('email, name, nickname, avatar_url, avatar_color')
    .eq('email', post.author_email)
    .single();

  const { data: reactions } = await supabase
    .from('reactions')
    .select('*')
    .eq('post_id', postId);

  const authorName = user?.nickname || user?.name || post.author_email;

  return dbToPost(post, reactions || [], authorName, user?.avatar_url, user?.avatar_color);
}
