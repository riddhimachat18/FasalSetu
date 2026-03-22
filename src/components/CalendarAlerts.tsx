import { useState, useEffect } from 'react';
import { Bell, Cloud, Droplet, Wind, AlertTriangle, Loader2, Thermometer, Sprout, Shield, TrendingUp } from 'lucide-react';
import { getUserLocation } from '../lib/user-location';
import { weatherService, type WeatherData } from '../services/weatherService';
import { smartAlertService, type SmartAlert } from '../services/smartAlertService';

export default function CalendarAlerts() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationName, setLocationName] = useState<string>('');
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    loadWeatherAndAlerts();
  }, []);

  const loadWeatherAndAlerts = async () => {
    try {
      setWeatherLoading(true);
      setAlertsLoading(true);
      const location = await getUserLocation();
      
      if (location && location.latitude && location.longitude) {
        // Load weather data
        const weatherData = await weatherService.getWeatherByCoordinates(
          location.latitude,
          location.longitude
        );
        setWeather(weatherData);
        
        // Set location name
        if (location.city) {
          setLocationName(location.city + (location.state ? `, ${location.state}` : ''));
        } else {
          setLocationName(`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`);
        }

        // Generate smart alerts from weather forecast
        console.log('🔔 Generating smart alerts from weather API...');
        const smartAlerts = await smartAlertService.generateSmartAlerts(
          location.latitude,
          location.longitude
        );
        setAlerts(smartAlerts);
        console.log(`✅ Loaded ${smartAlerts.length} alerts from weather forecast`);
      }
    } catch (error) {
      console.error('Error loading weather and alerts:', error);
    } finally {
      setWeatherLoading(false);
      setAlertsLoading(false);
    }
  };

  const getAlertIcon = (type: SmartAlert['type']) => {
    switch (type) {
      case 'weather':
        return Cloud;
      case 'irrigation':
        return Droplet;
      case 'fertilizer':
        return Sprout;
      case 'pest':
      case 'disease':
        return Shield;
      case 'harvest':
        return TrendingUp;
      case 'soil':
        return Thermometer;
      default:
        return AlertTriangle;
    }
  };

  const getAlertColor = (priority: SmartAlert['priority']) => {
    switch (priority) {
      case 'critical':
        return 'border-l-red-600 bg-red-50';
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Weather Widget */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
        {weatherLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : weather ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white mb-1">Today's Weather</h3>
                <p className="text-blue-100 text-sm">{locationName || 'Your Location'}</p>
              </div>
              <Cloud className="w-12 h-12 text-blue-100" />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl">{Math.round(weather.temperature)}°C</span>
              <span className="text-blue-100">{weather.condition}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-blue-400">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4" />
                <span className="text-sm">{weather.humidity}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4" />
                <span className="text-sm">{Math.round(weather.windSpeed)} km/h</span>
              </div>
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                <span className="text-sm">{weather.rainfall > 0 ? `${weather.rainfall}mm` : 'No rain'}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <Cloud className="w-12 h-12 text-blue-100 mx-auto mb-3 opacity-50" />
            <p className="text-blue-100 mb-2">Weather data unavailable</p>
            <p className="text-blue-200 text-xs mb-3">Location not found in database</p>
            <button 
              onClick={loadWeatherAndAlerts}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm text-white transition-colors"
            >
              Retry
            </button>
            <p className="text-blue-200 text-xs mt-3">
              Tip: Refresh the page to update location
            </p>
          </div>
        )}
      </div>

      {/* Alerts Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-gray-700" />
          <h2 className="text-gray-800">Alerts & Notifications</h2>
        </div>
        {alertsLoading ? (
          <div className="flex items-center justify-center py-8 bg-white rounded-xl">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No alerts at this time</p>
            <p className="text-gray-400 text-sm mt-1">We'll notify you of any important updates</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl p-4 border-l-4 ${getAlertColor(alert.priority)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-gray-800">{alert.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        alert.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        alert.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {alert.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{alert.description}</p>
                    <p className="text-gray-500 text-xs">Action: {alert.actionRequired}</p>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
