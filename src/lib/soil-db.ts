/**
 * Soil Database Helper Functions
 * Handles saving and retrieving soil data from Supabase
 * Uses Gemini AI to generate soil data based on location
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth-helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SoilData {
  pH: number;
  nitrogen: number;
  organicCarbon: number;
  cec: number;
  clay: number;
  sand: number;
  silt: number;
  bulkDensity: number;
  soilType: string;
  depth: string;
  latitude: number;
  longitude: number;
}

export interface DBSoilData {
  farm_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  ph_level: number | null;
  total_nitrogen: number | null;
  organic_carbon: number | null;
  cec: number | null;
  clay_pct: number | null;
  sand_pct: number | null;
  silt_pct: number | null;
  bulk_density: number | null;
  soil_type_name: string | null;
  sample_depth: string;
  data_source: string;
  recorded_at: string;
}

/**
 * Generate soil data using Gemini AI based on location
 */
async function generateSoilDataWithGemini(latitude: number, longitude: number, city?: string, state?: string, country?: string): Promise<SoilData | null> {
  try {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Gemini API key not found');
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const locationStr = city && state ? `${city}, ${state}, ${country}` : `coordinates ${latitude}, ${longitude}`;
    
    const prompt = `You are a soil science expert. Based on the location ${locationStr}, provide typical soil properties for agricultural land in this region.

Respond ONLY with a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "pH": <number between 4.0-9.0>,
  "nitrogen": <number in cg/kg, typical range 50-300>,
  "organicCarbon": <number in g/kg, typical range 5-30>,
  "cec": <number in cmol(+)/kg, typical range 5-40>,
  "clay": <percentage 0-100>,
  "sand": <percentage 0-100>,
  "silt": <percentage 0-100>,
  "bulkDensity": <number in cg/cm³, typical range 100-180>,
  "soilType": "<descriptive name like 'Loamy Soil', 'Clay Loam', 'Sandy Loam', etc>"
}

Note: clay + sand + silt should equal 100.
Base your estimates on typical agricultural soils in this geographic region.`;

    console.log('🤖 Asking Gemini for soil data for', locationStr);
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log('📝 Gemini raw response:', response);
    
    // Parse JSON response
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const soilProps = JSON.parse(cleanResponse);
    
    console.log('✅ Parsed soil data:', soilProps);
    
    // Validate and return
    return {
      pH: soilProps.pH || 7.0,
      nitrogen: soilProps.nitrogen || 150,
      organicCarbon: soilProps.organicCarbon || 10,
      cec: soilProps.cec || 15,
      clay: soilProps.clay || 30,
      sand: soilProps.sand || 40,
      silt: soilProps.silt || 30,
      bulkDensity: soilProps.bulkDensity || 140,
      soilType: soilProps.soilType || 'Loamy Soil',
      depth: '0-5cm',
      latitude,
      longitude
    };
  } catch (error) {
    console.error('Error generating soil data with Gemini:', error);
    return null;
  }
}

/**
 * Save soil data to database
 */
export async function saveSoilDataToDatabase(soilData: SoilData): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    // Insert soil data
    const { error } = await supabase
      .from('farm_soil_data')
      .insert({
        user_id: user.id,
        latitude: soilData.latitude,
        longitude: soilData.longitude,
        ph_level: soilData.pH,
        total_nitrogen: soilData.nitrogen,
        organic_carbon: soilData.organicCarbon,
        cec: soilData.cec,
        clay_pct: soilData.clay,
        sand_pct: soilData.sand,
        silt_pct: soilData.silt,
        bulk_density: soilData.bulkDensity,
        soil_type_name: soilData.soilType,
        sample_depth: soilData.depth,
        data_source: 'Gemini AI',
        recorded_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save soil data:', error);
      return false;
    }

    console.log('✅ Soil data saved to database');
    return true;
  } catch (error) {
    console.error('Error saving soil data:', error);
    return false;
  }
}

/**
 * Get the most recent soil data for the current user
 */
export async function getSoilDataFromDatabase(): Promise<SoilData | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('farm_soil_data')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching soil data from database:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const record = data[0];

    // Convert database format to SoilData format
    return {
      pH: record.ph_level || 7.0,
      nitrogen: record.total_nitrogen || 0,
      organicCarbon: record.organic_carbon || 0,
      cec: record.cec || 0,
      clay: record.clay_pct || 0,
      sand: record.sand_pct || 0,
      silt: record.silt_pct || 0,
      bulkDensity: record.bulk_density || 0,
      soilType: record.soil_type_name || 'Unknown',
      depth: record.sample_depth,
      latitude: record.latitude,
      longitude: record.longitude
    };
  } catch (error) {
    console.error('Error fetching soil data:', error);
    return null;
  }
}

/**
 * Get all soil data records for the current user
 */
export async function getAllSoilDataFromDatabase(): Promise<DBSoilData[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('farm_soil_data')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data;
  } catch (error) {
    console.error('Error fetching all soil data:', error);
    return [];
  }
}

/**
 * Fetch and save soil data using Gemini AI based on user's location
 */
export async function fetchAndSaveSoilData(): Promise<SoilData | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    // Get user's location from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('latitude, longitude, city, state, country')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.latitude || !userData.longitude) {
      console.error('User location not found in database');
      return null;
    }

    console.log(`🌱 Generating soil data for: ${userData.city || 'Unknown'}, ${userData.state || 'Unknown'}`);

    // Generate soil data using Gemini AI
    const soilData = await generateSoilDataWithGemini(
      userData.latitude,
      userData.longitude,
      userData.city,
      userData.state,
      userData.country
    );
    
    if (!soilData) {
      console.error('Failed to generate soil data with Gemini');
      return null;
    }

    // Save to database
    const saved = await saveSoilDataToDatabase(soilData);
    
    if (!saved) {
      console.error('Failed to save soil data to database');
      return null;
    }

    return soilData;
  } catch (error) {
    console.error('Error in fetchAndSaveSoilData:', error);
    return null;
  }
}

/**
 * Check if soil data needs to be updated (older than 30 days)
 */
export function shouldUpdateSoilData(lastUpdate?: string): boolean {
  if (!lastUpdate) return true;
  
  const lastUpdateTime = new Date(lastUpdate).getTime();
  const now = new Date().getTime();
  const daysSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);
  
  // Update if older than 30 days (soil properties change slowly)
  return daysSinceUpdate > 30;
}

/**
 * Get or update soil data (checks cache first)
 */
export async function getOrUpdateSoilData(): Promise<SoilData | null> {
  try {
    // First, try to get saved soil data from database
    const savedData = await getSoilDataFromDatabase();
    
    if (savedData) {
      console.log('📊 Using cached soil data from database');
      return savedData;
    }
    
    // No saved data, generate with Gemini
    console.log('📊 No cached soil data, generating with Gemini AI...');
    return await fetchAndSaveSoilData();
  } catch (error) {
    console.error('Error in getOrUpdateSoilData:', error);
    return null;
  }
}
