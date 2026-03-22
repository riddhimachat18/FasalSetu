// Smart Alert Generation Service
// Generates intelligent farming alerts based on weather forecast, crop context, and soil data

import { weatherService, type ForecastDay, type DetailedWeatherForecast } from './weatherService';
import { getActiveCrops, type CropCycle } from '../lib/crop-db';
import { getSoilDataFromDatabase } from '../lib/soil-db';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth-helpers';

export interface SmartAlert {
  id: string;
  type: 'weather' | 'irrigation' | 'fertilizer' | 'pest' | 'harvest' | 'disease' | 'soil';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: string;
  affectedCrops: string[];
  date: string;
  forecastDay?: ForecastDay;
}

export class SmartAlertService {
  /**
   * Generate smart alerts based on weather forecast and farm context
   */
  async generateSmartAlerts(
    latitude: number,
    longitude: number
  ): Promise<SmartAlert[]> {
    try {
      console.log('🧠 Generating smart alerts...');
      
      const alerts: SmartAlert[] = [];
      
      // Fetch weather forecast
      const forecast = await weatherService.getDetailedForecastByCoordinates(latitude, longitude, 7);
      if (!forecast) {
        console.warn('⚠️ Could not fetch weather forecast');
        return [];
      }

      // Fetch crop context
      const crops = await getActiveCrops();
      
      // Fetch soil data
      const soilData = await getSoilDataFromDatabase();
      
      // Fetch recent disease logs
      const user = await getCurrentUser();
      let recentDiseases: any[] = [];
      if (user) {
        const { data } = await supabase
          .from('disease_logs')
          .select('disease_name, severity, crop_cycle_id, detection_date')
          .eq('user_id', user.id)
          .gte('detection_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('detection_date', { ascending: false });
        recentDiseases = data || [];
      }

      console.log('📊 Context loaded:', {
        forecastDays: forecast.forecast.forecastday.length,
        crops: crops.length,
        soilData: !!soilData,
        recentDiseases: recentDiseases.length
      });

      // Track if we've seen rain in the forecast
      let hasRainInForecast = false;
      let daysWithoutRain = 0;

      // Generate alerts for each forecast day
      for (let i = 0; i < forecast.forecast.forecastday.length; i++) {
        const day = forecast.forecast.forecastday[i];
        
        // Track rain patterns
        if (day.day.daily_chance_of_rain > 30 || day.day.totalprecip_mm > 1) {
          hasRainInForecast = true;
        } else {
          daysWithoutRain++;
        }

        // Heavy rain alerts (priority over regular rain)
        if (day.day.totalprecip_mm > 50) {
          alerts.push(this.generateHeavyRainAlert(day, crops));
        }
        // Rain alerts (only if not heavy rain)
        else if (day.day.daily_chance_of_rain > 70 && day.day.totalprecip_mm > 5) {
          alerts.push(this.generateRainAlert(day, crops));
        }

        // High temperature alerts
        if (day.day.maxtemp_c > 35) {
          alerts.push(this.generateHeatAlert(day, crops));
        }

        // Low temperature alerts
        if (day.day.mintemp_c < 10) {
          alerts.push(this.generateColdAlert(day, crops));
        }

        // High wind alerts
        if (day.day.maxwind_kph > 40) {
          alerts.push(this.generateWindAlert(day, crops));
        }

        // High humidity + disease risk (only once per forecast)
        if (i === 0 && day.day.avghumidity > 80 && recentDiseases.length > 0) {
          alerts.push(this.generateDiseaseRiskAlert(day, crops, recentDiseases));
        }

        // UV alerts (only for next 2 days)
        if (i < 2 && day.day.uv > 8) {
          alerts.push(this.generateUVAlert(day));
        }
      }

      // Generate irrigation alert only if there's a sustained period without rain
      if (daysWithoutRain >= 3) {
        const nextDryDay = forecast.forecast.forecastday.find(
          day => day.day.daily_chance_of_rain < 20 && day.day.totalprecip_mm < 2
        );
        if (nextDryDay) {
          alerts.push(this.generateIrrigationAlert(nextDryDay, crops, soilData));
        }
      }

      // Fertilizer alerts based on soil data
      if (soilData) {
        const fertilizerAlert = this.generateFertilizerAlert(soilData, crops);
        if (fertilizerAlert) alerts.push(fertilizerAlert);
      }

      // Harvest alerts based on crop stage
      const harvestAlerts = this.generateHarvestAlerts(crops);
      alerts.push(...harvestAlerts);

      // Ensure minimum alerts - add informational alerts if needed
      if (alerts.length < 3) {
        const fillerAlerts = this.generateFillerAlerts(forecast, crops, soilData, alerts.length);
        alerts.push(...fillerAlerts);
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Limit to top 6 alerts to avoid overwhelming
      const finalAlerts = alerts.slice(0, 6);

      console.log(`✅ Generated ${finalAlerts.length} smart alerts`);
      return finalAlerts;
    } catch (error) {
      console.error('❌ Error generating smart alerts:', error);
      return [];
    }
  }

  private generateRainAlert(day: ForecastDay, crops: CropCycle[]): SmartAlert {
    const daysAway = this.getDaysAway(day.date);
    const timing = daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;
    
    return {
      id: `rain-${day.date}`,
      type: 'weather',
      title: `Rain Expected ${this.formatDate(day.date)}`,
      description: `${day.day.daily_chance_of_rain}% chance of rain ${timing} (${Math.round(day.day.totalprecip_mm)}mm expected). ${day.day.condition.text}.`,
      priority: day.day.totalprecip_mm > 20 ? 'high' : 'medium',
      actionRequired: 'Delay pesticide/fungicide application. Postpone irrigation. Ensure proper drainage.',
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateHeavyRainAlert(day: ForecastDay, crops: CropCycle[]): SmartAlert {
    return {
      id: `heavy-rain-${day.date}`,
      type: 'weather',
      title: `Heavy Rain Alert - ${this.formatDate(day.date)}`,
      description: `Heavy rainfall expected: ${day.day.totalprecip_mm}mm. Risk of waterlogging and soil erosion.`,
      priority: 'critical',
      actionRequired: 'Check drainage systems. Protect young plants. Avoid field operations. Monitor for fungal diseases.',
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateHeatAlert(day: ForecastDay, crops: CropCycle[]): SmartAlert {
    return {
      id: `heat-${day.date}`,
      type: 'weather',
      title: `High Temperature Alert - ${this.formatDate(day.date)}`,
      description: `Maximum temperature: ${day.day.maxtemp_c}°C. Heat stress risk for crops.`,
      priority: day.day.maxtemp_c > 40 ? 'critical' : 'high',
      actionRequired: 'Increase irrigation frequency. Apply mulch. Provide shade for sensitive crops. Monitor for heat stress.',
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateColdAlert(day: ForecastDay, crops: CropCycle[]): SmartAlert {
    return {
      id: `cold-${day.date}`,
      type: 'weather',
      title: `Low Temperature Alert - ${this.formatDate(day.date)}`,
      description: `Minimum temperature: ${day.day.mintemp_c}°C. Risk of frost damage.`,
      priority: day.day.mintemp_c < 5 ? 'critical' : 'high',
      actionRequired: 'Protect sensitive crops. Consider frost covers. Delay sowing if planned. Monitor for frost damage.',
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateWindAlert(day: ForecastDay, crops: CropCycle[]): SmartAlert {
    return {
      id: `wind-${day.date}`,
      type: 'weather',
      title: `High Wind Alert - ${this.formatDate(day.date)}`,
      description: `Strong winds expected: ${day.day.maxwind_kph} km/h. Risk of crop lodging.`,
      priority: day.day.maxwind_kph > 60 ? 'critical' : 'high',
      actionRequired: 'Stake tall plants. Secure greenhouse structures. Avoid spraying operations. Check for lodging.',
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateDiseaseRiskAlert(day: ForecastDay, crops: CropCycle[], diseases: any[]): SmartAlert {
    const diseaseNames = diseases.map(d => d.disease_name).join(', ');
    return {
      id: `disease-risk-${day.date}`,
      type: 'disease',
      title: `Disease Risk Alert - ${this.formatDate(day.date)}`,
      description: `High humidity (${day.day.avghumidity}%) + recent diseases detected. Favorable conditions for disease spread.`,
      priority: 'high',
      actionRequired: `Monitor for ${diseaseNames}. Apply preventive fungicides. Improve air circulation. Remove infected plants.`,
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateIrrigationAlert(day: ForecastDay, crops: CropCycle[], soilData: any): SmartAlert {
    const sandContent = soilData?.sand_pct || 0;
    const drainageSpeed = sandContent > 60 ? 'fast' : sandContent > 40 ? 'moderate' : 'slow';
    
    return {
      id: `irrigation-needed`,
      type: 'irrigation',
      title: `Irrigation Recommended`,
      description: `No significant rain expected for next several days. Soil moisture may be low, especially for ${drainageSpeed}-draining soils.`,
      priority: 'medium',
      actionRequired: `Check soil moisture and water crops if needed. ${drainageSpeed === 'fast' ? 'Water deeply and frequently' : 'Water moderately'}.`,
      affectedCrops: crops.map(c => c.crop_name),
      date: day.date,
      forecastDay: day
    };
  }

  private generateUVAlert(day: ForecastDay): SmartAlert {
    return {
      id: `uv-${day.date}`,
      type: 'weather',
      title: `High UV Index - ${this.formatDate(day.date)}`,
      description: `UV index: ${day.day.uv}. Very high sun exposure.`,
      priority: 'low',
      actionRequired: 'Wear protective clothing. Apply sunscreen. Work during early morning or late evening.',
      affectedCrops: [],
      date: day.date,
      forecastDay: day
    };
  }

  private generateFertilizerAlert(soilData: any, crops: CropCycle[]): SmartAlert | null {
    const nitrogen = soilData.total_nitrogen || 0;
    const organicCarbon = soilData.organic_carbon || 0;
    
    if (nitrogen < 0.1 || organicCarbon < 5) {
      return {
        id: 'fertilizer-alert',
        type: 'fertilizer',
        title: 'Soil Nutrient Alert',
        description: `Low soil nutrients detected. Nitrogen: ${(nitrogen * 1000).toFixed(1)} g/kg, Organic Carbon: ${organicCarbon.toFixed(1)} g/kg.`,
        priority: 'high',
        actionRequired: 'Apply nitrogen fertilizer (Urea/DAP). Add organic matter (compost/manure). Consider soil testing.',
        affectedCrops: crops.map(c => c.crop_name),
        date: new Date().toISOString().split('T')[0]
      };
    }
    return null;
  }

  private generateHarvestAlerts(crops: CropCycle[]): SmartAlert[] {
    const alerts: SmartAlert[] = [];
    const today = new Date();
    
    for (const crop of crops) {
      if (crop.expected_harvest_date) {
        const harvestDate = new Date(crop.expected_harvest_date);
        const daysUntilHarvest = Math.ceil((harvestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilHarvest > 0 && daysUntilHarvest <= 14) {
          alerts.push({
            id: `harvest-${crop.crop_id}`,
            type: 'harvest',
            title: `Harvest Approaching - ${crop.crop_name}`,
            description: `Expected harvest in ${daysUntilHarvest} days (${this.formatDate(crop.expected_harvest_date)}).`,
            priority: daysUntilHarvest <= 7 ? 'high' : 'medium',
            actionRequired: 'Prepare harvesting equipment. Arrange labor. Check market prices. Plan storage.',
            affectedCrops: [crop.crop_name],
            date: crop.expected_harvest_date
          });
        }
      }
    }
    
    return alerts;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  private getDaysAway(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate filler alerts when there aren't enough critical alerts
   * These are informational and helpful but not urgent
   */
  private generateFillerAlerts(
    forecast: any,
    crops: CropCycle[],
    soilData: any,
    currentCount: number
  ): SmartAlert[] {
    const fillers: SmartAlert[] = [];
    const needed = Math.max(0, 4 - currentCount);
    
    if (needed === 0) return fillers;

    const today = forecast.forecast.forecastday[0];
    const tomorrow = forecast.forecast.forecastday[1];
    const nextWeek = forecast.forecast.forecastday[forecast.forecast.forecastday.length - 1];

    // Weather summary alert
    if (fillers.length < needed) {
      fillers.push({
        id: 'weather-summary',
        type: 'weather',
        title: 'Weather Outlook',
        description: `Current: ${Math.round(today.day.avgtemp_c)}°C, ${today.day.condition.text}. Tomorrow: ${Math.round(tomorrow.day.avgtemp_c)}°C, ${tomorrow.day.condition.text}.`,
        priority: 'low',
        actionRequired: 'Plan field activities based on weather conditions. Check forecast daily.',
        affectedCrops: crops.map(c => c.crop_name),
        date: today.date,
        forecastDay: today
      });
    }

    // Soil monitoring reminder
    if (fillers.length < needed && soilData) {
      const ph = soilData.ph_h2o || 7;
      const phStatus = ph < 6 ? 'acidic' : ph > 8 ? 'alkaline' : 'neutral';
      fillers.push({
        id: 'soil-monitoring',
        type: 'soil',
        title: 'Soil Health Check',
        description: `Soil pH: ${ph.toFixed(1)} (${phStatus}). Regular monitoring helps optimize crop growth.`,
        priority: 'low',
        actionRequired: 'Monitor soil moisture levels. Consider soil testing if crop performance declines.',
        affectedCrops: crops.map(c => c.crop_name),
        date: new Date().toISOString().split('T')[0]
      });
    }

    // Crop monitoring reminder
    if (fillers.length < needed && crops.length > 0) {
      fillers.push({
        id: 'crop-monitoring',
        type: 'pest',
        title: 'Regular Crop Inspection',
        description: `Monitor your ${crops.map(c => c.crop_name).join(', ')} for signs of pests, diseases, or nutrient deficiencies.`,
        priority: 'low',
        actionRequired: 'Walk through fields daily. Check leaves, stems, and soil. Use AI disease detection for suspicious symptoms.',
        affectedCrops: crops.map(c => c.crop_name),
        date: new Date().toISOString().split('T')[0]
      });
    }

    // Optimal conditions alert
    if (fillers.length < needed) {
      const avgTemp = (today.day.avgtemp_c + tomorrow.day.avgtemp_c) / 2;
      const avgHumidity = (today.day.avghumidity + tomorrow.day.avghumidity) / 2;
      
      fillers.push({
        id: 'optimal-conditions',
        type: 'weather',
        title: 'Favorable Growing Conditions',
        description: `Temperature: ${Math.round(avgTemp)}°C, Humidity: ${Math.round(avgHumidity)}%. Good conditions for crop growth.`,
        priority: 'low',
        actionRequired: 'Good time for routine maintenance, weeding, and field inspections.',
        affectedCrops: crops.map(c => c.crop_name),
        date: today.date,
        forecastDay: today
      });
    }

    // Weekly planning alert
    if (fillers.length < needed) {
      const weekRainTotal = forecast.forecast.forecastday.reduce(
        (sum: number, day: any) => sum + day.day.totalprecip_mm, 0
      );
      fillers.push({
        id: 'weekly-planning',
        type: 'irrigation',
        title: 'Week Ahead Planning',
        description: `Expected rainfall this week: ${Math.round(weekRainTotal)}mm. Plan irrigation and field work accordingly.`,
        priority: 'low',
        actionRequired: 'Schedule field activities during dry periods. Prepare for any expected rain.',
        affectedCrops: crops.map(c => c.crop_name),
        date: today.date
      });
    }

    return fillers.slice(0, needed);
  }
}

export const smartAlertService = new SmartAlertService();
