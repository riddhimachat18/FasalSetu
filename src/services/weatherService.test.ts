// Weather API Test
import { weatherService } from './weatherService';

export async function testWeatherAPI() {
  console.log('🌤️ Testing Weather API...');
  
  try {
    // Test 1: Get weather by city name
    console.log('\n📍 Test 1: Weather by city name (Mumbai)');
    const mumbaiWeather = await weatherService.getWeather('Mumbai');
    console.log('Mumbai Weather:', mumbaiWeather);
    
    // Test 2: Get weather by coordinates (Delhi)
    console.log('\n📍 Test 2: Weather by coordinates (Delhi: 28.6139, 77.2090)');
    const delhiWeather = await weatherService.getWeatherByCoordinates(28.6139, 77.2090);
    console.log('Delhi Weather:', delhiWeather);
    
    // Test 3: Get weather with forecast
    console.log('\n📍 Test 3: Detailed forecast test');
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=d59e0fece23b490994e65944250511&q=Mumbai&days=7&aqi=no`
    );
    const data = await response.json();
    console.log('Full API Response:', JSON.stringify(data, null, 2));
    
    console.log('\n✅ Weather API tests completed!');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Weather API test failed:', error);
    return { success: false, error };
  }
}

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  (window as any).testWeatherAPI = testWeatherAPI;
  console.log('💡 Run testWeatherAPI() in console to test the weather API');
}
