#include <WiFi.h>
#include <WebServer.h>
#include "config.h"

WebServer server(80);

// Calibrated R0 values for the MQ sensors
float mq6R0 = 0.0;
float mq135R0 = 0.0;

// Filtered raw ADC values (for Exponential Moving Average filter)
float mq6FilteredRaw = -1.0;
float mq135FilteredRaw = -1.0;

// Current PPM values
float methanePPM = 0.0;
float ammoniaPPM = 0.0;
bool isDangerous = false;

// Timing variables
unsigned long previousMillis = 0;
const long readInterval = 1000; // Read sensors and run calculations every 1 second

// Buzzer state
unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;

// Function declarations
float readFilteredADC(int pin, float &filteredVal);
float readResistance(float filteredRaw, float rlValue);
float calibrateSensor(int pin, float rlValue, float cleanAirFactor);
float calculatePPM(float rs, float r0, float a, float b);
void handleRoot();
void handleData();
void handleCalibrate();
void handleBuzzer(bool danger);
void soundBeeps(int count, int durationMs);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n==================================");
  Serial.println("Hazardous Gas Detection System v2.0");
  Serial.println("==================================");

  // Configure pins
  pinMode(MQ6_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 1. Calibrate MQ Sensors (requires clean air environment)
  Serial.println("\n[Calibration] Please ensure sensors are in clean air...");
  mq6R0 = calibrateSensor(MQ6_PIN, MQ6_RL_VALUE, MQ6_CLEAN_AIR_FACTOR);
  mq135R0 = calibrateSensor(MQ135_PIN, MQ135_RL_VALUE, MQ135_CLEAN_AIR_FACTOR);
  Serial.println("[Calibration] Completed successfully.");
  soundBeeps(2, 100); // 2 short beeps to signal calibration complete

  // 2. Connect to WiFi with Timeout & AP Fallback
  Serial.print("\n[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long startConnect = millis();
  int attempt = 0;
  bool connected = true;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempt++;
    // Toggle Buzzer during connection to show progress
    digitalWrite(BUZZER_PIN, attempt % 2 == 0 ? HIGH : LOW);

    // Check for connection timeout
    if (millis() - startConnect >= WIFI_CONNECT_TIMEOUT_MS) {
      connected = false;
      break;
    }
  }
  digitalWrite(BUZZER_PIN, LOW); // Turn off buzzer

  if (connected) {
    Serial.println();
    Serial.println("[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    soundBeeps(2, 150); // Double beep for success
  } else {
    Serial.println();
    Serial.println("[WiFi] Connection timed out. Starting Emergency Access Point (AP)...");
    
    WiFi.disconnect();
    WiFi.mode(WIFI_AP);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS, WIFI_AP_CHAN, 0, WIFI_AP_CONN);
    
    Serial.print("[WiFi] SoftAP Online! SSID: ");
    Serial.println(WIFI_AP_SSID);
    Serial.print("[WiFi] Access Server at IP: ");
    Serial.println(WiFi.softAPIP());
    
    // Triple-beep to signal AP fallback mode active
    soundBeeps(3, 100);
  }

  // 3. Configure Web Server routes
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.on("/calibrate", handleCalibrate);

  server.begin();
  Serial.println("[HTTP] Server started on port 80");
  Serial.println("==================================\n");
}

void loop() {
  server.handleClient();

  unsigned long currentMillis = millis();
  
  // Read sensors and update calculations
  if (currentMillis - previousMillis >= readInterval) {
    previousMillis = currentMillis;

    // Apply digital noise filtering via EMA
    float mq6RawFiltered = readFilteredADC(MQ6_PIN, mq6FilteredRaw);
    float mq135RawFiltered = readFilteredADC(MQ135_PIN, mq135FilteredRaw);

    // Calculate resistances from filtered raw values
    float mq6Rs = readResistance(mq6RawFiltered, MQ6_RL_VALUE);
    float mq135Rs = readResistance(mq135RawFiltered, MQ135_RL_VALUE);

    // Calculate gas concentrations in PPM
    methanePPM = calculatePPM(mq6Rs, mq6R0, MQ6_CURVE_A, MQ6_CURVE_B);
    ammoniaPPM = calculatePPM(mq135Rs, mq135R0, MQ135_CURVE_A, MQ135_CURVE_B);

    // Validate levels against threshold safety triggers
    bool isMethaneHigh = methanePPM > METHANE_THRESHOLD;
    bool isAmmoniaHigh = ammoniaPPM > AMMONIA_THRESHOLD;
    isDangerous = isMethaneHigh || isAmmoniaHigh;

    // Log readings to Serial Monitor
    Serial.print("Methane: ");
    Serial.print(methanePPM, 2);
    Serial.print(" ppm (Raw Filtered: ");
    Serial.print(mq6RawFiltered, 1);
    Serial.print(") | Ammonia: ");
    Serial.print(ammoniaPPM, 2);
    Serial.print(" ppm (Raw Filtered: ");
    Serial.print(mq135RawFiltered, 1);
    Serial.print(") | Status: ");
    Serial.println(isDangerous ? "DANGER" : "NORMAL");
  }

  // Handle buzzer alarm (150ms beeps under danger, off otherwise)
  handleBuzzer(isDangerous);
}

// EMA Filter implementation for stable ADC readings
float readFilteredADC(int pin, float &filteredVal) {
  float rawVal = analogRead(pin);
  if (filteredVal < 0.0) {
    filteredVal = rawVal; // Initial state: initialize to first reading
  } else {
    // EMA formula: S_t = alpha * Y_t + (1 - alpha) * S_{t-1}
    filteredVal = (EMA_ALPHA * rawVal) + ((1.0 - EMA_ALPHA) * filteredVal);
  }
  return filteredVal;
}

// Compute sensor resistance Rs based on raw ADC voltage divider value
float readResistance(float filteredRaw, float rlValue) {
  float rawAvg = filteredRaw;
  if (rawAvg < 1.0) rawAvg = 1.0; // Avoid division by zero
  if (rawAvg >= ADC_MAX) rawAvg = ADC_MAX - 1.0;

  // Rs = RL * (ADC_MAX - Raw) / Raw
  return rlValue * ((ADC_MAX - rawAvg) / rawAvg);
}

// Perform baseline calibration sequence in clean air
float calibrateSensor(int pin, float rlValue, float cleanAirFactor) {
  float rsSum = 0;
  // Read sensor multiple times to average out noise during calibration
  for (int i = 0; i < 30; i++) {
    float dummyFilter = -1.0;
    float rawVal = readFilteredADC(pin, dummyFilter);
    rsSum += readResistance(rawVal, rlValue);
    delay(100);
  }
  float rsAvg = rsSum / 30.0;
  return rsAvg / cleanAirFactor; // R0 = Rs / CleanAirFactor
}

// Compute gas PPM using datasheet power function math: PPM = A * (Rs/R0)^B
float calculatePPM(float rs, float r0, float a, float b) {
  if (r0 <= 0.0) return 0.0;
  float ratio = rs / r0;
  if (ratio <= 0.0) return 0.0;
  return a * pow(ratio, b);
}

// Fallback HTML page direct browser display
void handleRoot() {
  String ipStr = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String modeStr = WiFi.status() == WL_CONNECTED ? "Station (Home WiFi)" : "Access Point Mode (AP)";

  String html = "<!DOCTYPE html><html><head><title>Gas Detection ESP32</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<style>";
  html += "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f8fafc; text-align: center; padding: 50px 20px; }";
  html += ".card { background: rgba(22, 28, 45, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 30px; max-width: 550px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(8px); }";
  html += "h1 { color: #ef4444; margin-bottom: 5px; font-size: 26px; }";
  html += ".subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1px; }";
  html += "p { font-size: 16px; line-height: 1.6; color: #cbd5e1; text-align: left; }";
  html += ".ip-box { background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 18px; font-weight: bold; text-align: center; color: #06b6d4; margin: 20px 0; }";
  html += ".btn { display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 15px; transition: opacity 0.2s; width: 100%; box-sizing: border-box; text-align: center; }";
  html += ".btn:hover { opacity: 0.9; }";
  html += "li { text-align: left; margin-bottom: 8px; color: #cbd5e1; }";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h1>ESP32 Gas Detection Node v2.0</h1>";
  html += "<div class='subtitle'>Active Mode: " + modeStr + "</div>";
  html += "<p>This hardware node is actively broadcasting telemetry readings.</p>";
  html += "<ul>";
  html += "<li><strong>Methane (CH4) Sensor</strong>: Pin A0 (GPIO 34)</li>";
  html += "<li><strong>Ammonia (NH3) Sensor</strong>: Pin A0 (GPIO 35)</li>";
  html += "<li><strong>Noise Filtering</strong>: Active (EMA Alpha = 0.15)</li>";
  html += "</ul>";
  html += "<div class='ip-box'>" + ipStr + "</div>";
  html += "<p>To view the React telemetry dashboard, open the local developer workspace dashboard, click the settings gear, and configure this IP address.</p>";
  html += "<a class='btn' href='/data' target='_blank'>Fetch Raw JSON Telemetry</a>";
  html += "<a class='btn' href='/calibrate' style='background: #10b981; margin-top: 10px;'>Perform Remote Sensor Calibration</a>";
  html += "</div></body></html>";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", html);
}

// Serves current gas levels in JSON format
void handleData() {
  String json = "{";
  json += "\"methane\": " + String(methanePPM, 2) + ",";
  json += "\"ammonia\": " + String(ammoniaPPM, 2) + ",";
  json += "\"isDangerous\": " + String(isDangerous ? "true" : "false") + ",";
  json += "\"status\": \"" + String(isDangerous ? "Danger: High gas levels detected!" : "Gas levels are normal.") + "\"";
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// Remote web calibration route
void handleCalibrate() {
  // Sound start beep pattern
  soundBeeps(1, 400);
  Serial.println("[HTTP] Web requested sensor recalibration started...");
  
  // Re-run calibration (averages readings over 3 seconds)
  mq6R0 = calibrateSensor(MQ6_PIN, MQ6_RL_VALUE, MQ6_CLEAN_AIR_FACTOR);
  mq135R0 = calibrateSensor(MQ135_PIN, MQ135_RL_VALUE, MQ135_CLEAN_AIR_FACTOR);
  
  // Reset EMA filter values to reflect fresh reading baseline
  mq6FilteredRaw = -1.0;
  mq135FilteredRaw = -1.0;

  String json = "{";
  json += "\"success\": true,";
  json += "\"mq6R0\": " + String(mq6R0, 2) + ",";
  json += "\"mq135R0\": " + String(mq135R0, 2) + ",";
  json += "\"message\": \"ESP32 successfully completed remote calibration sequence.\"";
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
  
  Serial.println("[HTTP] Sensors successfully recalibrated.");
  // Sound success beep pattern
  soundBeeps(2, 100);
}

// Output beeps logic
void soundBeeps(int count, int durationMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < count - 1) {
      delay(80); // Pause between beeps
    }
  }
}

// Handle buzzer alerts
void handleBuzzer(bool danger) {
  if (!danger) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
    return;
  }

  unsigned long currentMillis = millis();
  // Beep warning rhythm: 150ms active / 150ms inactive
  if (currentMillis - lastBuzzerToggle >= 150) {
    lastBuzzerToggle = currentMillis;
    buzzerState = !buzzerState;
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  }
}
