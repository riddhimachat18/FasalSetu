/**
 * Soil Service - SoilGrids API Integration
 * Fetches physical and chemical soil properties for AI-driven recommendations
 * API: https://api.openepi.io/soil
 */

// Assuming these imports are available in your environment for database interaction
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth-helpers';

const SOIL_PROPERTY_API = 'https://api.openepi.io/soil/property';
const SOIL_TYPE_API = 'https://api.openepi.io/soil/type';

export interface SoilData {
    // Chemical Properties
    pH: number;             // phh2o
    nitrogen: number;       // total_nitrogen (cg/kg)
    organicCarbon: number;  // organic_carbon (soc or ocs)
    cec: number;            // Cation Exchange Capacity
    
    // Physical Properties (Texture)
    clay: number;           // clay_pct
    sand: number;           // sand_pct
    silt: number;           // silt content
    bulkDensity: number;    // bulk_density
    
    // Soil Classification
    soilType: string;       // soil_type_name
    
    // Metadata
    depth: string;          // sample_depth
    latitude: number;
    longitude: number;
}

export class SoilService {
    /**
     * Get comprehensive soil data for a location
     * Fetches both physical/chemical properties and soil type classification
     */
    async getSoilData(latitude: number, longitude: number, depth: string = '0-5cm'): Promise<SoilData | null> {
        try {
            console.log(`🌱 Fetching soil data for (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) at depth ${depth}...`);

            // Fetch soil properties and type in parallel
            const [propertiesData, typeData] = await Promise.all([
                this.getSoilProperties(latitude, longitude, depth),
                this.getSoilType(latitude, longitude)
            ]);

            if (!propertiesData) {
                console.error('❌ Failed to fetch soil properties');
                return null;
            }

            const completeSoilData: SoilData = {
                ...propertiesData,
                soilType: typeData || 'Unknown',
                depth,
                latitude,
                longitude
            };

            // --- CRITICAL FIX: AUTOMATICALLY SAVE DATA TO DATABASE ---
            // This is where the save operation is performed immediately after successful fetch.
            const saved = await this.saveSoilDataToDatabase(completeSoilData);
            if (!saved) {
                console.warn('⚠️ Soil data obtained but failed to save to database. Check RLS/INSERT permissions.');
            }
            // --- END OF FIX ---

            return completeSoilData;
        } catch (error) {
            console.error('Error fetching soil data:', error);
            return null;
        }
    }

    /**
     * Inserts the structured SoilData object into the public.farm_soil_data table.
     */
    public async saveSoilDataToDatabase(soilData: SoilData): Promise<boolean> {
        try {
            const user = await getCurrentUser();
            if (!user) {
                console.error('User not authenticated. Cannot save soil data.');
                return false;
            }
            
            console.log('💾 Preparing soil data insert...');

            // --- CRITICAL FIX: MAPPING TO SQL COLUMN NAMES ---
            const insertPayload = {
                user_id: user.id, // UUID from auth
                
                // Metadata
                recorded_at: new Date().toISOString(), // Matches 'recorded_at' schema column
                sample_depth: soilData.depth,         // Matches 'sample_depth' schema column
                
                // Location
                latitude: soilData.latitude,
                longitude: soilData.longitude,
                
                // Soil Type
                soil_type_name: soilData.soilType,
                
                // Chemical Properties (using snake_case column names)
                ph_level: soilData.pH,
                total_nitrogen: soilData.nitrogen,
                organic_carbon: soilData.organicCarbon,
                
                // Physical Properties
                clay_pct: soilData.clay,
                sand_pct: soilData.sand,
                bulk_density: soilData.bulkDensity,
                
                // data_source column is nullable, not required here
            };
            // --- END OF MAPPING FIX ---

            const { error } = await supabase
                .from('farm_soil_data')
                .insert([insertPayload]);

            if (error) {
                console.error('❌ Supabase Error saving soil data (Check RLS/Constraints):', error);
                return false;
            }

            console.log('✅ Soil data saved successfully to database.');
            return true;
        } catch (error) {
            console.error('❌ Exception during soil data save:', error);
            return false;
        }
    }

    /**
     * Fetch soil physical and chemical properties from /property endpoint
     */
    private async getSoilProperties(latitude: number, longitude: number, depth: string) {
        try {
            // Request all relevant properties for fertilizer/irrigation recommendations
            const properties = [
                'phh2o',      // pH
                'nitrogen',   // Total Nitrogen
                'soc',        // Soil Organic Carbon
                'cec',        // Cation Exchange Capacity
                'clay',       // Clay content
                'sand',       // Sand content
                'silt',       // Silt content
                'bdod'        // Bulk Density
            ].join(',');

            const url = `${SOIL_PROPERTY_API}?lat=${latitude}&lon=${longitude}&depths=${depth}&properties=${properties}&values=mean`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Soil property API failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract mean values from the first depth layer
            const layer = data.properties?.layers?.[0];
            if (!layer) {
                throw new Error('No soil property data in response');
            }

            return {
                // Ensure default values are used for missing data
                pH: layer.phh2o?.mean || 7.0,
                nitrogen: layer.nitrogen?.mean || 0,
                organicCarbon: layer.soc?.mean || 0,
                cec: layer.cec?.mean || 0,
                clay: layer.clay?.mean || 0,
                sand: layer.sand?.mean || 0,
                silt: layer.silt?.mean || 0,
                bulkDensity: layer.bdod?.mean || 0
            };
        } catch (error) {
            console.error('Error fetching soil properties:', error);
            return null;
        }
    }

    /**
     * Fetch most probable soil type from /type endpoint
     */
    private async getSoilType(latitude: number, longitude: number): Promise<string | null> {
        try {
            const url = `${SOIL_TYPE_API}?lat=${latitude}&lon=${longitude}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Soil type API failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract the most probable soil type name
            const soilType = data.properties?.most_probable_soil_type;
            return soilType || null;
        } catch (error) {
            console.error('Error fetching soil type:', error);
            return null;
        }
    }

    /**
     * Interpret soil data for human-readable recommendations
     * (Unchanged)
     */
    interpretSoilData(soil: SoilData): {
        phInterpretation: string;
        nitrogenLevel: string;
        organicMatterLevel: string;
        textureType: string;
        compactionLevel: string;
        waterRetention: string;
    } {
        return {
            phInterpretation: this.interpretPH(soil.pH),
            nitrogenLevel: this.interpretNitrogen(soil.nitrogen),
            organicMatterLevel: this.interpretOrganicCarbon(soil.organicCarbon),
            textureType: this.interpretTexture(soil.clay, soil.sand, soil.silt),
            compactionLevel: this.interpretBulkDensity(soil.bulkDensity),
            waterRetention: this.interpretWaterRetention(soil.clay, soil.sand)
        };
    }

    private interpretPH(pH: number): string {
        if (pH < 5.5) return 'Acidic - Consider lime application';
        if (pH < 6.5) return 'Slightly acidic - Good for most crops';
        if (pH < 7.5) return 'Neutral - Optimal for most crops';
        if (pH < 8.5) return 'Slightly alkaline - May need gypsum';
        return 'Alkaline - Nutrient availability limited';
    }

    private interpretNitrogen(nitrogen: number): string {
        if (nitrogen < 100) return 'Low - Nitrogen fertilizer recommended';
        if (nitrogen < 200) return 'Moderate - Monitor crop needs';
        return 'High - Reduce nitrogen inputs';
    }

    private interpretOrganicCarbon(soc: number): string {
        if (soc < 10) return 'Very low - Add organic matter';
        if (soc < 20) return 'Low - Increase organic inputs';
        if (soc < 30) return 'Moderate - Maintain current practices';
        return 'High - Excellent soil health';
    }

    private interpretTexture(clay: number, sand: number, silt: number): string {
        if (clay > 40) return 'Clay - High water retention, slow drainage';
        if (sand > 60) return 'Sandy - Low water retention, fast drainage';
        if (silt > 40) return 'Silty - Good water retention and aeration';
        return 'Loamy - Ideal balance for most crops';
    }

    private interpretBulkDensity(bdod: number): string {
        // Bulk density in cg/cm³ (multiply by 0.01 to get g/cm³)
        const density = bdod * 0.01;
        if (density > 1.6) return 'Compacted - Consider tillage';
        if (density > 1.4) return 'Moderate - Monitor root growth';
        return 'Good - Adequate for root development';
    }

    private interpretWaterRetention(clay: number, sand: number): string {
        if (clay > 40) return 'High - Risk of waterlogging';
        if (sand > 60) return 'Low - Frequent irrigation needed';
        return 'Moderate - Balanced water management';
    }

    /**
     * Format soil data for display
     * (Unchanged)
     */
    formatSoilData(soil: SoilData): string {
        const interpretation = this.interpretSoilData(soil);
        return `
Soil Type: ${soil.soilType}
pH: ${soil.pH.toFixed(1)} (${interpretation.phInterpretation})
Nitrogen: ${soil.nitrogen.toFixed(0)} cg/kg (${interpretation.nitrogenLevel})
Organic Carbon: ${soil.organicCarbon.toFixed(1)} g/kg (${interpretation.organicMatterLevel})
Texture: ${interpretation.textureType}
    - Clay: ${soil.clay.toFixed(1)}%
    - Sand: ${soil.sand.toFixed(1)}%
    - Silt: ${soil.silt.toFixed(1)}%
Water Retention: ${interpretation.waterRetention}
Compaction: ${interpretation.compactionLevel}
    `.trim();
    }
}

export const soilService = new SoilService();