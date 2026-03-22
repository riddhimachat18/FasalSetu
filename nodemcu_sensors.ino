/*
 * FasalSetu Sensor Node — NodeMCU ESP8266-12E
 * ============================================
 * Sensors:
 *   - Capacitive Soil Moisture Sensor → A0  (analog, 0-1023)
 *   - DHT22 Air Temp + Humidity        → D4  (GPIO2, digital)
 *   - DS18B20 Soil Temp Probe          → D3  (GPIO0, digital, OneWire)
 *
 * WIRING DIAGRAM
 * ══════════════
 * NodeMCU 3V3 ──────────────────────── DHT22 Pin 1 (VCC)
 * NodeMCU GND ──────────────────────── DHT22 Pin 4 (GND)
 * NodeMCU D4  ──────────────────────── DHT22 Pin 2 (DATA)
 *                 10kΩ pull-up resistor between DHT22 Pin2 and VCC
 *
 * NodeMCU 3V3 ──────────────────────── DS18B20 Red wire (VCC)
 * NodeMCU GND ──────────────────────── DS18B20 Black wire (GND)
 * NodeMCU D3  ──────────────────────── DS18B20 Yellow wire (DATA)
 *                 4.7kΩ pull-up resistor between DS18B20 DATA and VCC
 *
 * NodeMCU 3V3 ──────────────────────── Moisture Sensor VCC
 * NodeMCU GND ──────────────────────── Moisture Sensor GND
 * NodeMCU A0  ──────────────────────── Moisture Sensor AOUT
 *
 * NOTE: If your moisture sensor outputs 0-5V (some modules do),
 *       add a voltage divider: two 10kΩ resistors between AOUT and A0
 *       to bring it down to 0-3.3V. NodeMCU A0 max is 3.3V!
 *       Most capacitive v1.2 modules output 0-3.3V — check your module.
 *
 * Libraries needed (install via Arduino IDE → Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - OneWire by Paul Stoffregen
 *   - DallasTemperature by Miles Burton
 *   - ESP8266WiFi (comes with ESP8266 board package)
 *   - ESP8266HTTPClient (comes with ESP8266 board package)
 *
 * Board setup in Arduino IDE:
 *   Tools → Board → ESP8266 Boards → NodeMCU 1.0 (ESP-12E Module)
 *   Tools → Upload Speed → 115200
 *   Tools → Port → (your COM port)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── CONFIGURATION — edit these ──────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* THINGSPEAK_API_KEY = "YOUR_WRITE_API_KEY";  // from ThingSpeak channel
const char* THINGSPEAK_URL = "http://api.thingspeak.com/update";

// ThingSpeak field mapping:
//   Field 1 → soil_moisture_pct
//   Field 2 → air_temp_c
//   Field 3 → air_humidity_pct
//   Field 4 → soil_temp_c
//   Field 5 → vpd_kpa  (calculated on device)
//   Field 6 → raw_moisture_adc  (for calibration)

const unsigned long SEND_INTERVAL_MS = 60000;  // send every 60 seconds

// ── PIN DEFINITIONS ─────────────────────────────────────────
#define DHTPIN        D4   // GPIO2
#define DHTTYPE       DHT22
#define DS18B20_PIN   D3   // GPIO0
#define MOISTURE_PIN  A0

// ── MOISTURE CALIBRATION ─────────────────────────────────────
// Calibrate these values for YOUR specific sensor + soil:
//   1. Put sensor in dry air → read ADC value → that's DRY_VALUE
//   2. Put sensor in water   → read ADC value → that's WET_VALUE
// Typical capacitive v1.2: dry=~750, wet=~320 (inverted — wet gives lower ADC)
const int MOISTURE_DRY_VALUE = 750;   // ADC reading in dry air
const int MOISTURE_WET_VALUE = 320;   // ADC reading fully submerged

// ── OBJECTS ──────────────────────────────────────────────────
DHT dht(DHTPIN, DHTTYPE);
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
WiFiClient wifiClient;
HTTPClient http;

unsigned long lastSendTime = 0;

// ── SETUP ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\nFasalSetu Sensor Node starting...");

  dht.begin();
  ds18b20.begin();

  connectWiFi();
}

// ── MAIN LOOP ────────────────────────────────────────────────
void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi dropped, reconnecting...");
    connectWiFi();
  }

  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;
    readAndSend();
  }
}

// ── READ ALL SENSORS AND SEND ─────────────────────────────────
void readAndSend() {
  Serial.println("\n--- Reading sensors ---");

  // 1. Read DHT22 (air temp + humidity)
  float airTemp = dht.readTemperature();
  float airHumidity = dht.readHumidity();

  if (isnan(airTemp) || isnan(airHumidity)) {
    Serial.println("ERROR: DHT22 read failed. Check wiring and pull-up resistor.");
    airTemp = -999;
    airHumidity = -999;
  }

  // 2. Read DS18B20 (soil temp)
  ds18b20.requestTemperatures();
  float soilTemp = ds18b20.getTempCByIndex(0);

  if (soilTemp == DEVICE_DISCONNECTED_C) {
    Serial.println("WARNING: DS18B20 not connected. Using air temp estimate.");
    // Fallback: estimate soil temp from air temp (from your project doc formula)
    soilTemp = (airTemp != -999) ? airTemp * 0.9 : -999;
  }

  // 3. Read moisture sensor (analog)
  int rawADC = analogRead(MOISTURE_PIN);
  float moisturePct = adcToMoisturePct(rawADC);

  // 4. Calculate VPD (Vapour Pressure Deficit) on-device
  //    VPD = es(T) * (1 - RH/100)
  //    es(T) = 0.6108 * exp(17.27*T / (T + 237.3))  [kPa, Tetens formula]
  float vpd = -999;
  if (airTemp != -999 && airHumidity != -999) {
    float es = 0.6108 * exp((17.27 * airTemp) / (airTemp + 237.3));
    vpd = es * (1.0 - airHumidity / 100.0);
  }

  // 5. Print to Serial for debugging
  Serial.printf("Air Temp:     %.1f °C\n", airTemp);
  Serial.printf("Air Humidity: %.1f %%\n", airHumidity);
  Serial.printf("Soil Temp:    %.1f °C\n", soilTemp);
  Serial.printf("Moisture:     %.1f %% (raw ADC: %d)\n", moisturePct, rawADC);
  Serial.printf("VPD:          %.3f kPa\n", vpd);

  // 6. Send to ThingSpeak
  sendToThingSpeak(moisturePct, airTemp, airHumidity, soilTemp, vpd, rawADC);
}

// ── MOISTURE ADC → PERCENTAGE ─────────────────────────────────
float adcToMoisturePct(int rawADC) {
  // Capacitive sensor: higher ADC = drier (inverted scale)
  // Clamp to calibration range
  rawADC = constrain(rawADC, MOISTURE_WET_VALUE, MOISTURE_DRY_VALUE);
  // Map inverted: dry value → 0%, wet value → 100%
  float pct = map(rawADC, MOISTURE_DRY_VALUE, MOISTURE_WET_VALUE, 0, 100);
  return pct;
}

// ── SEND TO THINGSPEAK ────────────────────────────────────────
void sendToThingSpeak(float moisture, float airTemp, float humidity,
                      float soilTemp, float vpd, int rawADC) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot send — no WiFi.");
    return;
  }

  // Build URL with fields
  String url = String(THINGSPEAK_URL) + "?api_key=" + THINGSPEAK_API_KEY;
  url += "&field1=" + String(moisture, 2);
  url += "&field2=" + String(airTemp, 2);
  url += "&field3=" + String(humidity, 2);
  url += "&field4=" + String(soilTemp, 2);
  if (vpd != -999) url += "&field5=" + String(vpd, 4);
  url += "&field6=" + String(rawADC);

  http.begin(wifiClient, url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    Serial.printf("ThingSpeak OK — entry number: %s\n", response.c_str());
  } else {
    Serial.printf("ThingSpeak ERROR — HTTP code: %d\n", httpCode);
    // Common errors:
    //   0 → connection refused (wrong URL or no internet)
    //  -1 → connection timeout
    // 401 → wrong API key
    // 400 → sending too fast (ThingSpeak minimum = 15 seconds between updates)
  }
  http.end();
}

// ── WIFI CONNECTION ───────────────────────────────────────────
void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nFailed to connect. Will retry in next loop.");
  }
}
