"""
thingspeak_bridge.py
====================
Polls your ThingSpeak channel every 60s and feeds live sensor data
into the FasalSetu orchestrator.

ThingSpeak channel field mapping (must match your NodeMCU firmware):
  Field 1 → soil_moisture_pct
  Field 2 → air_temp_c
  Field 3 → air_humidity_pct
  Field 4 → soil_temp_c
  Field 5 → vpd_kpa
  Field 6 → raw_moisture_adc

Setup:
  pip install requests python-dotenv

.env must contain:
  THINGSPEAK_CHANNEL_ID=your_channel_id     (number, from channel URL)
  THINGSPEAK_READ_API_KEY=your_read_key     (from channel API Keys tab)
"""

import os, time, json, requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

CHANNEL_ID     = os.getenv("THINGSPEAK_CHANNEL_ID")
READ_API_KEY   = os.getenv("THINGSPEAK_READ_API_KEY")
POLL_INTERVAL  = 60   # seconds — ThingSpeak free tier allows this fine

THINGSPEAK_BASE = "https://api.thingspeak.com"


def fetch_latest_reading() -> dict | None:
    """
    Fetches the single most recent entry from your ThingSpeak channel.
    Returns a clean dict with agronomic field names, or None on error.
    """
    url = f"{THINGSPEAK_BASE}/channels/{CHANNEL_ID}/feeds/last.json"
    params = {"api_key": READ_API_KEY}

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
    except requests.RequestException as e:
        print(f"[ThingSpeak] Fetch error: {e}")
        return None

    # Parse — ThingSpeak returns field1..field8 as strings or None
    def safe_float(val):
        try:
            return float(val) if val is not None else None
        except (ValueError, TypeError):
            return None

    reading = {
        "timestamp":         raw.get("created_at"),
        "soil_moisture_pct": safe_float(raw.get("field1")),
        "air_temp_c":        safe_float(raw.get("field2")),
        "air_humidity_pct":  safe_float(raw.get("field3")),
        "soil_temp_c":       safe_float(raw.get("field4")),
        "vpd_kpa":           safe_float(raw.get("field5")),
        "raw_moisture_adc":  safe_float(raw.get("field6")),
        "source":            f"ThingSpeak channel {CHANNEL_ID} (live sensor)"
    }

    # If DS18B20 not connected, firmware sends -999 as fallback marker
    # Replace with estimated value using your project's formula
    if reading["soil_temp_c"] is not None and reading["soil_temp_c"] < -100:
        if reading["air_temp_c"] is not None:
            reading["soil_temp_c"] = round(reading["air_temp_c"] * 0.9, 2)
            reading["soil_temp_source"] = "estimated (0.9 × air_temp)"
        else:
            reading["soil_temp_c"] = None

    # Recalculate VPD if firmware didn't send it (field5 missing)
    if reading["vpd_kpa"] is None:
        t = reading["air_temp_c"]
        rh = reading["air_humidity_pct"]
        if t is not None and rh is not None:
            es = 0.6108 * (2.71828 ** ((17.27 * t) / (t + 237.3)))
            reading["vpd_kpa"] = round(es * (1.0 - rh / 100.0), 4)

    return reading


def fetch_last_n_readings(n: int = 10) -> list[dict]:
    """
    Fetches the last N readings — useful for temporal feature calculation
    (7-day moisture trend, cumulative leaching index, etc.)
    """
    url = f"{THINGSPEAK_BASE}/channels/{CHANNEL_ID}/feeds.json"
    params = {"api_key": READ_API_KEY, "results": n}

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
    except requests.RequestException as e:
        print(f"[ThingSpeak] Fetch error: {e}")
        return []

    readings = []
    for entry in raw.get("feeds", []):
        def safe_float(val):
            try: return float(val) if val else None
            except: return None
        readings.append({
            "timestamp":         entry.get("created_at"),
            "soil_moisture_pct": safe_float(entry.get("field1")),
            "air_temp_c":        safe_float(entry.get("field2")),
            "air_humidity_pct":  safe_float(entry.get("field3")),
            "soil_temp_c":       safe_float(entry.get("field4")),
            "vpd_kpa":           safe_float(entry.get("field5")),
        })
    return readings


def validate_reading(reading: dict) -> tuple[bool, list[str]]:
    """
    Applies your Layer 1 rule-based safety checks from the project doc.
    Returns (is_valid, list_of_warnings).
    """
    warnings = []

    m  = reading.get("soil_moisture_pct")
    t  = reading.get("air_temp_c")
    rh = reading.get("air_humidity_pct")
    st = reading.get("soil_temp_c")
    vpd = reading.get("vpd_kpa")

    # Bounds checks
    if m  is not None and not (0 <= m  <= 100): warnings.append(f"Moisture out of range: {m}%")
    if t  is not None and not (0 <= t  <= 50):  warnings.append(f"Air temp out of range: {t}°C")
    if rh is not None and not (0 <= rh <= 100): warnings.append(f"Humidity out of range: {rh}%")
    if st is not None and not (0 <= st <= 50):  warnings.append(f"Soil temp out of range: {st}°C")

    # Agronomic alerts (from your project doc)
    if m is not None:
        # SMD proxy: if moisture < 25%, drought stress likely
        if m < 25:
            warnings.append(f"DROUGHT STRESS: soil moisture {m:.1f}% < 25% threshold")
        # Saturation excess: if moisture > 85%, leaching risk
        if m > 85:
            warnings.append(f"LEACHING RISK: soil moisture {m:.1f}% > 85% (saturation)")

    if vpd is not None and vpd > 3.0:
        warnings.append(f"HIGH VPD: {vpd:.2f} kPa > 3.0 kPa — plant stress likely")

    if st is not None and st < 12:
        warnings.append(f"COLD SOIL: {st:.1f}°C < 12°C — microbial activity suppressed, N mineralisation slow")

    is_valid = len([w for w in warnings if "out of range" in w]) == 0
    return is_valid, warnings


def reading_to_agent_input(reading: dict, soil_type: str = "Loamy",
                            crop_type: str = "Wheat") -> dict:
    """
    Converts a ThingSpeak reading into the exact dict format
    your NutrientPredictionAgent.predict() expects.
    """
    return {
        "sensor_data": {
            "temperature": reading.get("air_temp_c"),
            "humidity":    reading.get("air_humidity_pct"),
            "moisture":    reading.get("soil_moisture_pct"),
            "soil_temp":   reading.get("soil_temp_c"),
            "vpd":         reading.get("vpd_kpa"),
        },
        "soil_type":  soil_type,
        "crop_type":  crop_type,
        "source":     reading.get("source", "ThingSpeak"),
        "timestamp":  reading.get("timestamp"),
    }


def test_connection() -> bool:
    """
    Quick test — call this first to verify your channel ID and API key work.
    """
    print(f"Testing ThingSpeak connection...")
    print(f"  Channel ID:   {CHANNEL_ID}")
    print(f"  Read API Key: {READ_API_KEY[:8]}..." if READ_API_KEY else "  Read API Key: NOT SET")

    reading = fetch_latest_reading()
    if reading is None:
        print("FAILED — could not fetch data. Check CHANNEL_ID and READ_API_KEY in .env")
        return False

    print("SUCCESS — latest reading:")
    for k, v in reading.items():
        print(f"  {k}: {v}")

    is_valid, warnings = validate_reading(reading)
    if warnings:
        print(f"\nWarnings ({len(warnings)}):")
        for w in warnings: print(f"  ⚠ {w}")
    else:
        print("\nAll sensor values within valid ranges ✓")

    return True


def live_polling_loop(soil_type: str = "Loamy", crop_type: str = "Wheat"):
    """
    Runs forever, polling ThingSpeak and printing predictions.
    In production, replace the print() calls with agent calls.
    """
    print(f"Starting live polling loop (every {POLL_INTERVAL}s)...")
    print("Press Ctrl+C to stop.\n")

    while True:
        reading = fetch_latest_reading()
        if reading:
            is_valid, warnings = validate_reading(reading)
            ts = reading.get("timestamp", "unknown time")
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] New reading from {ts}")
            print(f"  Moisture: {reading.get('soil_moisture_pct')}%  "
                  f"Air Temp: {reading.get('air_temp_c')}°C  "
                  f"Humidity: {reading.get('air_humidity_pct')}%  "
                  f"VPD: {reading.get('vpd_kpa')} kPa")
            if warnings:
                for w in warnings: print(f"  ⚠ {w}")

            # TODO: pipe to agent
            # agent_input = reading_to_agent_input(reading, soil_type, crop_type)
            # result = agent.predict(**agent_input)
            # print(result["recommendation"])

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_connection()
    else:
        live_polling_loop()
