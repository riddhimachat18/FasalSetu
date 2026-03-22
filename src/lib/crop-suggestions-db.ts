import { supabase } from './supabase';
import { getCurrentUser } from './auth-helpers';

export interface CropSuggestion {
  suggestion_id: number;
  user_id: string;
  title: string;
  description: string;
  category: 'seasonal' | 'soil' | 'market' | 'disease' | 'fertilizer' | 'irrigation' | 'general';
  crop_context?: any;
  generated_at: string;
  is_helpful?: boolean | null;
  feedback_at?: string | null;
  ai_model?: string;
  confidence_score?: number;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSuggestionData {
  title: string;
  description: string;
  category: CropSuggestion['category'];
  crop_context?: any;
  confidence_score?: number;
  expires_at?: string;
}

/**
 * Get active suggestions for the current user
 */
export async function getActiveSuggestions(): Promise<CropSuggestion[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

/**
 * Create a new suggestion
 */
export async function createSuggestion(
  suggestionData: CreateSuggestionData
): Promise<CropSuggestion | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_suggestions')
      .insert({
        user_id: user.id,
        title: suggestionData.title,
        description: suggestionData.description,
        category: suggestionData.category,
        crop_context: suggestionData.crop_context,
        confidence_score: suggestionData.confidence_score,
        expires_at: suggestionData.expires_at,
        ai_model: 'gemini-2.0-flash-exp',
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return null;
  }
}

/**
 * Mark a suggestion as helpful or not helpful
 */
export async function markSuggestionHelpful(
  suggestionId: number,
  isHelpful: boolean
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('crop_suggestions')
      .update({
        is_helpful: isHelpful,
        feedback_at: new Date().toISOString()
      })
      .eq('suggestion_id', suggestionId)
      .eq('user_id', user.id);

    if (error) throw error;
    console.log(`✅ Marked suggestion ${suggestionId} as ${isHelpful ? 'helpful' : 'not helpful'}`);
    return true;
  } catch (error) {
    console.error('Error marking suggestion as helpful:', error);
    return false;
  }
}

/**
 * Deactivate a suggestion (soft delete)
 */
export async function deactivateSuggestion(suggestionId: number): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('crop_suggestions')
      .update({ is_active: false })
      .eq('suggestion_id', suggestionId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deactivating suggestion:', error);
    return false;
  }
}

/**
 * Delete old suggestions (cleanup)
 */
export async function deleteExpiredSuggestions(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_suggestions')
      .delete()
      .eq('user_id', user.id)
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('Error deleting expired suggestions:', error);
    return 0;
  }
}
