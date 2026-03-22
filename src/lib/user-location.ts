import { geolocationService, type LocationData } from '../services/geolocationService';
import { saveLocationToDatabase, getLocationFromDatabase, type UserLocation as DBUserLocation } from './location-sync';
import { getCurrentUser } from './auth-helpers';

export type UserLocation = DBUserLocation;

// Track if location update is in progress to prevent duplicate calls
let locationUpdateInProgress = false;

// Track if permission was denied to avoid repeated requests
let permissionDenied = false;
let lastPermissionCheck = 0;
const PERMISSION_CHECK_COOLDOWN = 60000; // 1 minute cooldown

/**
 * Get user's current location from browser and save to database
 */
export async function updateUserLocation(): Promise<UserLocation | null> {
  // Prevent duplicate calls
  if (locationUpdateInProgress) {
    console.log('⏳ Location update already in progress, skipping...');
    return null;
  }

  // Check if permission was recently denied
  const now = Date.now();
  if (permissionDenied && (now - lastPermissionCheck) < PERMISSION_CHECK_COOLDOWN) {
    console.log('🚫 Location permission was denied. Skipping request (cooldown active).');
    return null;
  }

  try {
    locationUpdateInProgress = true;
    lastPermissionCheck = now;

    const user = await getCurrentUser();
    if (!user) return null;

    // Get current location from browser
    const location = await geolocationService.getCurrentLocation();
    
    // If permission denied, set flag but continue to fallback
    if (!location) {
      permissionDenied = true;
      console.log('⚠️ Browser location unavailable, using fallback coordinates...');
      
      // Fallback to Delhi coordinates
      const fallbackLocation: LocationData = {
        latitude: 28.6872,
        longitude: 77.2140,
        accuracy: 1000,
        city: 'Delhi',
        state: 'Delhi',
        country: 'India'
      };
      
      // Save fallback location to database
      const saved = await saveLocationToDatabase(fallbackLocation);
      if (!saved) return null;
      
      return {
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        accuracy: fallbackLocation.accuracy,
        city: fallbackLocation.city,
        state: fallbackLocation.state,
        country: fallbackLocation.country,
        location_updated_at: new Date().toISOString()
      };
    }

    // If we got location, permission is granted
    permissionDenied = false;

    // Save to database
    const saved = await saveLocationToDatabase(location);
    if (!saved) return null;

    // Return the location data
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      city: location.city,
      state: location.state,
      country: location.country,
      location_updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error updating user location:', error);
    return null;
  } finally {
    locationUpdateInProgress = false;
  }
}

/**
 * Get user's saved location from database
 */
export async function getUserLocation(): Promise<UserLocation | null> {
  return getLocationFromDatabase();
}

/**
 * Check if user location needs to be updated (older than 24 hours)
 */
export function shouldUpdateLocation(lastUpdate?: string): boolean {
  if (!lastUpdate) return true;
  
  const lastUpdateTime = new Date(lastUpdate).getTime();
  const now = new Date().getTime();
  const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
  
  // Update if older than 24 hours
  return hoursSinceUpdate > 24;
}

/**
 * Get user location, updating if necessary
 */
export async function getOrUpdateUserLocation(): Promise<UserLocation | null> {
  try {
    // First, ALWAYS try to get saved location from database
    const savedLocation = await getUserLocation();
    
    // If we have a saved location, use it (even if old)
    if (savedLocation && savedLocation.latitude && savedLocation.longitude) {
      // Only update if it's very old (>24 hours) AND permission wasn't denied
      if (shouldUpdateLocation(savedLocation.location_updated_at) && !permissionDenied) {
        // Update in background, don't wait for it
        updateUserLocation().catch(() => {});
      }
      return savedLocation;
    }
    
    // No saved location, try to get it (only if permission not denied)
    if (!permissionDenied) {
      return await updateUserLocation();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Reset permission denied flag (call this when user manually grants permission)
 */
export function resetPermissionDenied(): void {
  permissionDenied = false;
  lastPermissionCheck = 0;
  console.log('✅ Permission denied flag reset');
}

/**
 * Format location for display
 */
export function formatLocation(location: UserLocation): string {
  const parts: string[] = [];
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.country) parts.push(location.country);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}
