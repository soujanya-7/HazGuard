#include <WiFi.h>
#include <WebServer.h>
#include "config.h"

WebServer server(80);

// Calibrated R0 values for the MQ sensors
float mq6R0 = 0.0;
float mq135R0 = 0.0;

// Current PPM values
float methanePPM = 0.0;
float ammoniaPPM = 0.0;
bool isDangerous = false;

// Timing variables
unsigned long previousMillis = 0;
const long readInterval = 1000; // Read sensors every 1 second

// Buzzer state
unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;

// Function declarations
float readResistance(int pin, float rlValue);
float calibrateSensor(int pin, float rlValue, float cleanAirFactor);
float calculatePPM(float rs, float r0, float a, float b);
void handleRoot();
void handleData();
void handleBuzzer(bool danger);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n==================================");
  Serial.println("Hazardous Gas Detection System");
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

  // 2. Connect to WiFi
  Serial.print("\n[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempt++;
    // Toggle Buzzer during connection to show progress
    digitalWrite(BUZZER_PIN, attempt % 2 == 0 ? HIGH : LOW);
  }
  digitalWrite(BUZZER_PIN, LOW); // Turn off buzzer after connecting

  Serial.println();
  Serial.println("[WiFi] Connected!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  // 3. Configure Web Server routes
  server.on("/", handleRoot);
  server.on("/data", handleData);

  server.begin();
  Serial.println("[HTTP] Server started on port 80");
  Serial.println("==================================\n");
}

void loop() {
  server.handleClient();

  unsigned long currentMillis = millis();
  
  // Read sensors at standard intervals
  if (currentMillis - previousMillis >= readInterval) {
    previousMillis = currentMillis;

    // Read resistances
    float mq6Rs = readResistance(MQ6_PIN, MQ6_RL_VALUE);
    float mq135Rs = readResistance(MQ135_PIN, MQ135_RL_VALUE);

    // Calculate PPMs
    methanePPM = calculatePPM(mq6Rs, mq6R0, MQ6_CURVE_A, MQ6_CURVE_B);
    ammoniaPPM = calculatePPM(mq135Rs, mq135R0, MQ135_CURVE_A, MQ135_CURVE_B);

    // Check thresholds
    bool isMethaneHigh = methanePPM > METHANE_THRESHOLD;
    bool isAmmoniaHigh = ammoniaPPM > AMMONIA_THRESHOLD;
    isDangerous = isMethaneHigh || isAmmoniaHigh;

    // Output reading to Serial Monitor
    Serial.print("Methane: ");
    Serial.print(methanePPM, 2);
    Serial.print(" ppm | Ammonia: ");
    Serial.print(ammoniaPPM, 2);
    Serial.print(" ppm | Status: ");
    Serial.println(isDangerous ? "DANGER" : "NORMAL");
  }

  // Handle buzzer alarms dynamically in real-time
  handleBuzzer(isDangerous);
}

// Average multiple ADC readings to get stable resistance values
float readResistance(int pin, float rlValue) {
  long sum = 0;
  for (int i = 0; i < READ_SAMPLE_TIMES; i++) {
    sum += analogRead(pin);
    delay(READ_SAMPLE_INTERVAL);
  }
  float rawAvg = (float)sum / READ_SAMPLE_TIMES;
  if (rawAvg < 1.0) rawAvg = 1.0; // Avoid division by zero and extreme values
  if (rawAvg >= ADC_MAX) rawAvg = ADC_MAX - 1.0;

  // Rs = RL * (ADC_MAX - Raw) / Raw
  return rlValue * ((ADC_MAX - rawAvg) / rawAvg);
}

// Perform calibration in clean air
float calibrateSensor(int pin, float rlValue, float cleanAirFactor) {
  float rsSum = 0;
  for (int i = 0; i < 30; i++) {
    rsSum += readResistance(pin, rlValue);
    delay(100);
  }
  float rsAvg = rsSum / 30.0;
  return rsAvg / cleanAirFactor;
}

// Calculate PPM using curve formula
float calculatePPM(float rs, float r0, float a, float b) {
  if (r0 <= 0.0) return 0.0;
  float ratio = rs / r0;
  if (ratio <= 0.0) return 0.0;
  return a * pow(ratio, b);
}

// Serve simple fallback page for browser access
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>Gas Detection ESP32</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<style>";
  html += "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #121212; color: #e0e0e0; text-align: center; padding: 50px 20px; }";
  html += ".card { background: #1e1e1e; border-radius: 8px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }";
  html += "h1 { color: #ff3b30; }";
  html += "p { font-size: 18px; line-height: 1.6; }";
  html += ".btn { display: inline-block; background-color: #007aff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 20px; transition: background 0.2s; }";
  html += ".btn:hover { background-color: #0056b3; }";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h1>ESP32 Gas Detection Node</h1>";
  html += "<p>This ESP32 is online and broadcasting sensor values.</p>";
  html += "<p>Data endpoint: <code>/data</code></p>";
  html += "<p>To view the beautiful, real-time dashboard, please run the React web application in the project's <code>/dashboard</code> folder and connect to this device's IP:</p>";
  html += "<h3>" + WiFi.localIP().toString() + "</h3>";
  html += "<a class='btn' href='/data' target='_blank'>View Raw JSON Data</a>";
  html += "</div></body></html>";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", html);
}

// JSON Data Endpoint for React Dashboard
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

// Toggle buzzer alarm pattern
void handleBuzzer(bool danger) {
  if (!danger) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
    return;
  }

  unsigned long currentMillis = millis();
  // Beep warning: 150ms ON, 150ms OFF
  if (currentMillis - lastBuzzerToggle >= 150) {
    lastBuzzerToggle = currentMillis;
    buzzerState = !buzzerState;
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  }
}
