
import { supabase } from './supabase';

export type NotificationType = 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'REPOST' | 'DUET' | 'STITCH';

export const createNotification = async (
  userId: string, // Target user
  actorId: string, // User who triggered the notification
  type: NotificationType,
  postId?: string,
  content?: string
) => {
  // Don't notify yourself
  if (userId === actorId) return;

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      actor_id: actorId,
      type,
      post_id: postId,
      content
    });

    if (error) {
      console.error('Error creating notification:', error);
    }
  } catch (err) {
    console.error('Notification system failure:', err);
  }
};
