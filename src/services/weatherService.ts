// Weather API Integration
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  forecast: string;
  condition: string;
  windSpeed: number;
}

export interface ForecastDay {
  date: string;
  date_epoch: number;
  day: {
    maxtemp_c: number;
    maxtemp_f: number;
    mintemp_c: number;
    mintemp_f: number;
    avgtemp_c: number;
    avgtemp_f: number;
    maxwind_mph: number;
    maxwind_kph: number;
    totalprecip_mm: number;
    totalprecip_in: number;
    avgvis_km: number;
    avgvis_miles: number;
    avghumidity: number;
    daily_will_it_rain: number;
    daily_chance_of_rain: number;
    daily_will_it_snow: number;
    daily_chance_of_snow: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    uv: number;
    totalsnow_cm: number;
  };
}

export interface DetailedWeatherForecast {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    wind_kph: number;
    humidity: number;
    feelslike_c: number;
    uv: number;
  };
  forecast: {
    forecastday: ForecastDay[];
  };
}

export class WeatherService {
  /**
   * Get weather by location name or coordinates
   * @param location - City name or "lat,lon" format (e.g., "28.6139,77.2090")
   */
  async getWeather(location: string): Promise<WeatherData | null> {
    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${location}&days=3&aqi=no`
      );

      if (!response.ok) throw new Error('Weather API failed');

      const data = await response.json();
      const current = data.current;
      const forecast = data.forecast.forecastday[0];

      return {
        temperature: current.temp_c,
        humidity: current.humidity,
        rainfall: forecast.day.totalprecip_mm,
        forecast: forecast.day.condition.text,
        condition: current.condition.text,
        windSpeed: current.wind_kph,
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  }

  /**
   * Get detailed 7-day weather forecast
   * @param location - City name or "lat,lon" format
   * @param days - Number of forecast days (1-14)
   */
  async getDetailedForecast(location: string, days: number = 7): Promise<DetailedWeatherForecast | null> {
    try {
      console.log(`🌤️ Fetching ${days}-day forecast for ${location}...`);
      
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${location}&days=${days}&aqi=no&alerts=yes`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather API error:', errorText);
        throw new Error(`Weather API failed: ${response.status}`);
      }

      const data: DetailedWeatherForecast = await response.json();
      console.log('✅ Weather forecast fetched successfully');
      return data;
    } catch (error) {
      console.error('Error fetching detailed forecast:', error);
      return null;
    }
  }

  /**
   * Get weather by coordinates
   * @param latitude - Latitude coordinate
   * @param longitude - Longitude coordinate
   */
  async getWeatherByCoordinates(latitude: number, longitude: number): Promise<WeatherData | null> {
    const location = `${latitude},${longitude}`;
    return this.getWeather(location);
  }

  /**
   * Get detailed forecast by coordinates
   */
  async getDetailedForecastByCoordinates(
    latitude: number, 
    longitude: number, 
    days: number = 7
  ): Promise<DetailedWeatherForecast | null> {
    const location = `${latitude},${longitude}`;
    return this.getDetailedForecast(location, days);
  }
}

export const weatherService = new WeatherService();
