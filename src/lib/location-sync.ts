/**
 * Location Sync - Database Operations
 * Handles saving and retrieving location data from Supabase
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth-helpers';
import type { LocationData } from '../services/geolocationService';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  state?: string;
  country?: string;
  location_updated_at?: string;
}

/**
 * Save location data to database
 */
export async function saveLocationToDatabase(locationData: LocationData): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { error } = await supabase
      .from('users')
      .update({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_accuracy: locationData.accuracy,
        city: locationData.city || null,
        state: locationData.state || null,
        country: locationData.country || null,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to save location:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving location:', error);
    return false;
  }
}

/**
 * Get saved location from database
 */
export async function getLocationFromDatabase(): Promise<UserLocation | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('latitude, longitude, location_accuracy, city, state, country, location_updated_at')
      .eq('id', user.id)
      .single();

    if (error || !data || !data.latitude || !data.longitude) {
      return null;
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.location_accuracy,
      city: data.city,
      state: data.state,
      country: data.country,
      location_updated_at: data.location_updated_at
    };
  } catch (error) {
    return null;
  }
}
