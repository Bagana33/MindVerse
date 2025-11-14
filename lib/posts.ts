// Supabase-based post storage
import { supabaseClient } from '../components/supabaseClient';

export type ReactionType = 'FIRE' | 'WOW' | 'LOVE';
export type PostReaction = { userEmail: string; type: ReactionType };
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: PostReaction[]; // One reaction per user
  visibility: Visibility;
};

// Helper to convert DB format to UserPost
function dbToPost(dbRow: any, reactions: any[]): UserPost {
  return {
    id: dbRow.id,
    title: dbRow.text, // Using text field for title
    description: dbRow.text,
    author: dbRow.author_email,
    authorEmail: dbRow.author_email,
    points: 100, // Default points
    createdAt: dbRow.created_at,
    imageUrl: dbRow.image_data,
    reactions: reactions.map(r => ({ userEmail: r.user_email, type: r.type.toUpperCase() })),
    visibility: 'PUBLIC',
  };
}

export async function createPost(data: Omit<UserPost, "id" | "points" | "createdAt" | "reactions">): Promise<UserPost> {
  const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: inserted, error } = await supabaseClient
    .from('posts')
    .insert([{
      id: postId,
      author_email: data.authorEmail,
      text: data.title || data.description,
      image_data: data.imageUrl,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }

  return dbToPost(inserted, []);
}

export async function getUserPosts(email: string): Promise<UserPost[]> {
  const { data: posts, error: postsError } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('author_email', email)
    .order('created_at', { ascending: false });

  if (postsError || !posts) return [];

  // Get reactions for all posts
  const postIds = posts.map(p => p.id);
  const { data: reactions } = await supabaseClient
    .from('reactions')
    .select('*')
    .in('post_id', postIds);

  return posts.map(post => {
    const postReactions = reactions?.filter(r => r.post_id === post.id) || [];
    return dbToPost(post, postReactions);
  });
}

export async function getAllPosts(): Promise<UserPost[]> {
  const { data: posts, error: postsError } = await supabaseClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (postsError || !posts) return [];

  // Get all reactions
  const postIds = posts.map(p => p.id);
  const { data: reactions } = await supabaseClient
    .from('reactions')
    .select('*')
    .in('post_id', postIds);

  return posts.map(post => {
    const postReactions = reactions?.filter(r => r.post_id === post.id) || [];
    return dbToPost(post, postReactions);
  });
}

export async function deletePost(postId: string, userEmail: string): Promise<boolean> {
  const { error } = await supabaseClient
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
): Promise<{ success: boolean; added: boolean; removed: boolean; updated: boolean; post?: UserPost }> {
  // Check existing reaction
  const { data: existing } = await supabaseClient
    .from('reactions')
    .select('*')
    .eq('post_id', postId)
    .eq('user_email', userEmail)
    .maybeSingle();

  if (existing) {
    if (existing.type.toUpperCase() === type) {
      // Remove reaction
      const { error } = await supabaseClient
        .from('reactions')
        .delete()
        .eq('id', existing.id);
      
      if (error) return { success: false, added: false, removed: false, updated: false };
      
      const post = await getPost(postId);
      return { success: true, added: false, removed: true, updated: false, post: post || undefined };
    } else {
      // Update reaction type
      const { error } = await supabaseClient
        .from('reactions')
        .update({ type: type.toLowerCase() })
        .eq('id', existing.id);
      
      if (error) return { success: false, added: false, removed: false, updated: false };
      
      const post = await getPost(postId);
      return { success: true, added: false, removed: false, updated: true, post: post || undefined };
    }
  } else {
    // Add new reaction
    const { error } = await supabaseClient
      .from('reactions')
      .insert([{
        post_id: postId,
        user_email: userEmail,
        type: type.toLowerCase(),
      }]);
    
    if (error) return { success: false, added: false, removed: false, updated: false };
    
    const post = await getPost(postId);
    return { success: true, added: true, removed: false, updated: false, post: post || undefined };
  }
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
  const { data: post, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) return null;

  const { data: reactions } = await supabaseClient
    .from('reactions')
    .select('*')
    .eq('post_id', postId);

  return dbToPost(post, reactions || []);
}
