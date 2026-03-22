import { supabase } from './supabase';
import { getCurrentUser } from './auth-helpers';

export interface CropCycle {
  crop_id: number;
  crop_name: string;
  sowing_date: string;
  expected_harvest_date?: string;
  current_stage: string;
  predicted_yield?: number;
  is_active: boolean;
  user_id: string;
}

export interface CreateCropData {
  crop_name: string;
  sowing_date: string;
  current_stage: string;
  expected_harvest_date?: string;
  predicted_yield?: number;
}

/**
 * Calculate expected harvest date based on crop type and sowing date
 */
function calculateExpectedHarvest(cropName: string, sowingDate: string): string {
  const sowing = new Date(sowingDate);
  
  // Average crop durations in days (simplified)
  const cropDurations: Record<string, number> = {
    'Wheat': 120,
    'Rice': 120,
    'Maize': 90,
    'Mustard': 90,
    'Chickpea': 120,
    'Lentil': 110,
    'Cotton': 180,
    'Sugarcane': 365,
    'Tomato': 75,
    'Potato': 90,
    'Onion': 120,
  };
  
  const duration = cropDurations[cropName] || 100; // Default 100 days
  const harvestDate = new Date(sowing);
  harvestDate.setDate(harvestDate.getDate() + duration);
  
  return harvestDate.toISOString().split('T')[0];
}

/**
 * Add a new crop cycle to the database
 */
export async function addCropCycle(cropData: CreateCropData): Promise<CropCycle | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Calculate expected harvest if not provided
    const expectedHarvest = cropData.expected_harvest_date || 
      calculateExpectedHarvest(cropData.crop_name, cropData.sowing_date);

    const { data, error } = await supabase
      .from('crop_cycles')
      .insert({
        user_id: user.id,
        crop_name: cropData.crop_name,
        sowing_date: cropData.sowing_date,
        current_stage: cropData.current_stage,
        expected_harvest_date: expectedHarvest,
        predicted_yield: cropData.predicted_yield,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding crop cycle:', error);
    return null;
  }
}

/**
 * Get all active crops for the current user
 */
export async function getActiveCrops(): Promise<CropCycle[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_cycles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('crop_id', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active crops:', error);
    return [];
  }
}

/**
 * Get all crops (active and inactive) for the current user
 */
export async function getAllCrops(): Promise<CropCycle[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_cycles')
      .select('*')
      .eq('user_id', user.id)
      .order('crop_id', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all crops:', error);
    return [];
  }
}

/**
 * Update a crop cycle
 */
export async function updateCropCycle(
  cropId: number,
  updates: Partial<CreateCropData>
): Promise<CropCycle | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('crop_cycles')
      .update(updates)
      .eq('crop_id', cropId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating crop cycle:', error);
    return null;
  }
}

/**
 * Mark a crop as inactive (harvest completed)
 */
export async function markCropAsHarvested(cropId: number): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('crop_cycles')
      .update({ is_active: false })
      .eq('crop_id', cropId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking crop as harvested:', error);
    return false;
  }
}

/**
 * Delete a crop cycle
 */
export async function deleteCropCycle(cropId: number): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('crop_cycles')
      .delete()
      .eq('crop_id', cropId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting crop cycle:', error);
    return false;
  }
}

/**
 * Get crop status based on disease logs from database
 */
export async function getCropStatus(crop: CropCycle): Promise<'healthy' | 'attention' | 'critical'> {
  try {
    console.log(`🔄 Re-evaluating status for ${crop.crop_name} from database...`);
    
    // Check if there's a manual status override first
    const { data: manualStatus, error: manualError } = await supabase
      .from('crop_cycles')
      .select('manual_status, manual_status_updated_at')
      .eq('crop_id', crop.crop_id)
      .single();

    // If manual status was set recently (within last 7 days), use it
    if (manualStatus?.manual_status && manualStatus.manual_status_updated_at) {
      const statusDate = new Date(manualStatus.manual_status_updated_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (statusDate > sevenDaysAgo) {
        console.log(`✅ Using manual status for ${crop.crop_name}: ${manualStatus.manual_status}`);
        return manualStatus.manual_status as 'healthy' | 'attention' | 'critical';
      } else {
        console.log(`⏰ Manual status expired for ${crop.crop_name}, calculating from disease logs...`);
      }
    }

    // Fetch recent disease logs for this crop (last 30 days) - FRESH FROM DATABASE
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`📊 Querying disease_logs for ${crop.crop_name} (last 30 days)...`);
    const { data: diseaseLogs, error } = await supabase
      .from('disease_logs')
      .select('severity, detection_date, disease_name')
      .eq('crop_cycle_id', crop.crop_id)
      .gte('detection_date', thirtyDaysAgo.toISOString())
      .order('detection_date', { ascending: false });

    if (error) {
      console.error('Error fetching disease logs:', error);
      return 'healthy'; // Default to healthy if error
    }

    // No disease logs = healthy
    if (!diseaseLogs || diseaseLogs.length === 0) {
      console.log(`✅ ${crop.crop_name}: No diseases found → Status: HEALTHY`);
      return 'healthy';
    }

    // Count diseases by severity - RE-EVALUATED FROM DATABASE
    const severeDiseases = diseaseLogs.filter(d => d.severity === 'severe').length;
    const moderateDiseases = diseaseLogs.filter(d => d.severity === 'moderate').length;
    const mildDiseases = diseaseLogs.filter(d => d.severity === 'mild').length;
    const totalDiseases = diseaseLogs.length;

    console.log(`🔍 ${crop.crop_name} disease analysis (from database):`, {
      severe: severeDiseases,
      moderate: moderateDiseases,
      mild: mildDiseases,
      total: totalDiseases,
      diseases: diseaseLogs.map(d => `${d.disease_name} (${d.severity})`).join(', ')
    });

    // CRITERIA 1: Critical - 2+ diseases OR any severe disease
    if (totalDiseases >= 2) {
      console.log(`🔴 ${crop.crop_name}: ${totalDiseases} diseases detected → Status: CRITICAL (Urgent Action)`);
      return 'critical';
    }
    
    if (severeDiseases > 0) {
      console.log(`🔴 ${crop.crop_name}: Severe disease detected → Status: CRITICAL (Urgent Action)`);
      return 'critical';
    }

    // CRITERIA 2: Attention - 1 moderate or mild disease
    if (moderateDiseases > 0 || mildDiseases > 0) {
      console.log(`🟡 ${crop.crop_name}: 1 mild/moderate disease → Status: ATTENTION`);
      return 'attention';
    }

    // Default to healthy
    return 'healthy';
  } catch (error) {
    console.error('Error in getCropStatus:', error);
    return 'healthy';
  }
}

/**
 * Manually update crop status (e.g., when farmer says crop is healthy)
 */
export async function updateCropStatus(
  cropId: number,
  status: 'healthy' | 'attention' | 'critical'
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('crop_cycles')
      .update({
        manual_status: status,
        manual_status_updated_at: new Date().toISOString()
      })
      .eq('crop_id', cropId)
      .eq('user_id', user.id);

    if (error) throw error;
    
    console.log(`✅ Updated crop ${cropId} status to: ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating crop status:', error);
    return false;
  }
}
export { supabase };

