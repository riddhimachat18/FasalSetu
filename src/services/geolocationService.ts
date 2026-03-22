/**
 * Geolocation Service - Pure Browser Interaction
 * Handles only browser geolocation API and reverse geocoding
 * No database operations - see location-sync.ts for that
 */

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    city?: string;
    state?: string;
    country?: string;
}

export class GeolocationService {
    // Get user's current location
    async getCurrentLocation(): Promise<LocationData | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.error('Geolocation is not supported by this browser');
                resolve(null);
                return;
            }

            console.log('📍 Requesting geolocation from browser...');

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const locationData: LocationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    };

                    console.log('✅ Geolocation success:', {
                        lat: locationData.latitude.toFixed(4),
                        lon: locationData.longitude.toFixed(4),
                        accuracy: Math.round(locationData.accuracy) + 'm'
                    });

                    // Try to get city/state from reverse geocoding
                    try {
                        console.log('🌍 Reverse geocoding coordinates...');
                        const address = await this.reverseGeocode(
                            locationData.latitude,
                            locationData.longitude
                        );
                        locationData.city = address.city;
                        locationData.state = address.state;
                        locationData.country = address.country;
                        console.log('✅ Location:', address.city || address.state || 'Unknown area');
                    } catch (error) {
                        console.warn('⚠️ Reverse geocoding failed, using coordinates only');
                    }

                    resolve(locationData);
                },
                (error) => {
                    let errorMessage = 'Failed to get location';
                    let errorCode = error.code;

                    switch (error.code) {
                        case 1: // PERMISSION_DENIED
                            errorMessage = '❌ Location permission denied';
                            console.error('Permission denied. Please allow location access in browser settings.');
                            break;
                        case 2: // POSITION_UNAVAILABLE
                            errorMessage = '❌ Location information unavailable';
                            console.error('GPS/network location unavailable. Check internet connection.');
                            break;
                        case 3: // TIMEOUT
                            errorMessage = '❌ Location request timed out';
                            console.error('Location request took too long. Try again.');
                            break;
                    }

                    console.warn(errorMessage, `(Error code: ${errorCode})`);
                    resolve(null);
                },
                {
                    enableHighAccuracy: false, // FIX A: Set to FALSE to prioritize network location (less demanding)
                    timeout: 8000, // Reduced to 8 seconds. Fail faster if network is slow.
                    maximumAge: 0,
                }
            );
        });
    }

    // Reverse geocode coordinates to address
    private async reverseGeocode(
        lat: number,
        lon: number
    ): Promise<{ city?: string; state?: string; country?: string }> {
        try {
            // Using OpenStreetMap Nominatim API (free, no key required)
            const response = await fetch(
                // Added a brief pause in case this function is called immediately on load
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'FasalSetu/1.0', // Essential for Nominatim API policy compliance
                    },
                }
            );

            if (!response.ok) throw new Error('Geocoding failed');

            const data = await response.json();
            const address = data.address || {};

            return {
                city: address.city || address.town || address.village || address.county,
                state: address.state,
                country: address.country,
            };
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return {};
        }
    }

    // Format location for display
    formatLocation(location: LocationData): string {
        const parts: string[] = [];
        if (location.city) parts.push(location.city);
        if (location.state) parts.push(location.state);
        if (location.country) parts.push(location.country);
        return parts.join(', ') || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }

    // Check if geolocation is available
    isAvailable(): boolean {
        return 'geolocation' in navigator;
    }

    // Test geolocation (for debugging)
    async testGeolocation(): Promise<void> {
        console.log('🧪 Testing Geolocation...');
        console.log('---');

        // Check if available
        console.log('1. Geolocation API available:', this.isAvailable());

        // Check permission
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            console.log('2. Permission state:', permission.state);
        } catch (e) {
            console.log('2. Permission query not supported');
        }

        // Try to get location
        console.log('3. Attempting to get location...');
        const location = await this.getCurrentLocation();

        if (location) {
            console.log('✅ SUCCESS! Location obtained:');
            console.log('   Latitude:', location.latitude);
            console.log('   Longitude:', location.longitude);
            console.log('   Accuracy:', Math.round(location.accuracy) + 'm');
            console.log('   City:', location.city || 'Unknown');
            console.log('   State:', location.state || 'Unknown');
            console.log('   Country:', location.country || 'Unknown');
        } else {
            console.log('❌ FAILED to get location');
        }

        console.log('---');
        console.log('Troubleshooting steps:');
        console.log('1. Check browser address bar for location icon');
        console.log('2. Click it and ensure location is "Allowed"');
        console.log('3. Try refreshing the page');
        console.log('4. Check browser console for detailed errors');
        console.log('---');
    }
}

// Export singleton instance
export const geolocationService = new GeolocationService();

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
    (window as any).testGeolocation = () => geolocationService.testGeolocation();
}