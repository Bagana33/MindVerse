// Comments management for posts
import { supabase } from './supabase';

export type Comment = {
  id: string;
  postId: string;
  authorEmail: string;
  authorName?: string;
  content: string;
  isAI: boolean;
  parentCommentId?: string | null;
  createdAt: string;
};

function dbToComment(dbRow: any): Comment {
  return {
    id: dbRow.id,
    postId: dbRow.post_id,
    authorEmail: dbRow.author_email,
    content: dbRow.content,
    isAI: dbRow.is_ai || false,
    parentCommentId: dbRow.parent_comment_id ?? null,
    createdAt: dbRow.created_at,
  };
}

export async function createComment(data: {
  postId: string;
  authorEmail: string;
  content: string;
  isAI?: boolean;
  parentCommentId?: string;
}): Promise<Comment> {
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: inserted, error } = await supabase
    .from('comments')
    .insert([{
      id: commentId,
      post_id: data.postId,
      author_email: data.authorEmail,
      content: data.content,
      is_ai: data.isAI || false,
      parent_comment_id: data.parentCommentId || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    throw error;
  }

  return dbToComment(inserted);
}

export async function getPostComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map(dbToComment);
}

// Batch counts for comments to avoid N+1 queries in feed
export async function getCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  if (!postIds.length) return {};
  // Supabase: use group by via RPC-like approach with select and group
  const { data, error } = await supabase
    .from('comments')
    .select('post_id')
    .in('post_id', postIds);

  if (error || !data) return {};
  const map: Record<string, number> = {};
  for (const row of data as any[]) {
    const id = row.post_id as string;
    map[id] = (map[id] || 0) + 1;
  }
  // Ensure all ids are present
  for (const id of postIds) {
    if (!(id in map)) map[id] = 0;
  }
  return map;
}

export async function deleteComment(commentId: string, userEmail: string): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_email', userEmail);

  return !error;
}
