# IoT Hazardous Gas Detection & Monitoring System

This project is a complete IoT-based gas detection and monitoring system using an **ESP32 microcontroller** paired with an **MQ-6** (Methane/LPG) sensor, an **MQ-135** (Ammonia/Air Quality) sensor, an active buzzer alarm, and a **modern React-based dashboard** for real-time safety telemetry.

---

## Features

- **Microcontroller**: ESP32 NodeMCU managing dual analog sensors and buzzer outputs.
- **Improved Sensors Math**: Logarithmic PPM calculation curves based on sensor datasheets instead of basic linear approximations.
- **Startup Auto-Calibration**: Measures clean-air resistance ($R_0$) upon boot for improved accuracy.
- **Dynamic Warning System**: Pulsing warning alert beeps (150ms on/off pattern) via the buzzer during danger states.
- **CORS API Endpoint**: ESP32 serves raw sensor data in JSON format on `/data` with full CORS permissions allowed, enabling external dashboard client apps to connect directly.
- **Glassmorphic React Dashboard**:
  - Sleek Cyberpunk/Dark-mode aesthetic.
  - Real-time polling with status badges (Connected, Reconnecting, Disconnected).
  - Dynamic gauges and cards for Methane and Ammonia levels in PPM (color-changing based on danger levels).
  - Collapsible IP configuration menu saving preferences to local storage.
  - Custom SVG line chart plotting historical trends and warning thresholds (zero external charting package weight!).
  - Event log record keeping sessions statistics (minimum/maximum values) and chronological notification history.

---

## Hardware Configuration & Wiring

Refer to the image [GAS DETECTION.jpg](file:///Users/selvarajks/Downloads/HAZADROUS_GAS_DETECTION-main/GAS DETECTION.jpg) in the project root to see the breadboard prototype layout.

### Wiring Connections Table

| Component | Component Pin | ESP32 GPIO Pin | Connection Type | Details / Notes |
|---|---|---|---|---|
| **MQ-6 Sensor** | VCC | Vin / 5V | Power | Heater requires 5V to run |
| **MQ-6 Sensor** | GND | GND | Power | Common ground |
| **MQ-6 Sensor** | A0 (Analog Output) | **GPIO 34** | Analog Input | Methane gas readings |
| **MQ-135 Sensor**| VCC | Vin / 5V | Power | Heater requires 5V to run |
| **MQ-135 Sensor**| GND | GND | Power | Common ground |
| **MQ-135 Sensor**| A0 (Analog Output) | **GPIO 35** | Analog Input | Ammonia gas / Air quality readings |
| **Buzzer** | (+) Positive / Long pin | **GPIO 32** | Digital Output | Sound alarm output pin |
| **Buzzer** | (-) Negative / Short pin | GND | Power | Common ground |

---

## Software Installation & Setup

### 1. ESP32 Firmware Upload
1. Ensure you have the **Arduino IDE** (or VS Code with PlatformIO) installed.
2. Open the Arduino IDE.
3. Open the file [gas_detection.ino](file:///Users/selvarajks/Downloads/HAZADROUS_GAS_DETECTION-main/gas_detection/gas_detection.ino) located inside the `gas_detection` directory.
4. Open the [config.h](file:///Users/selvarajks/Downloads/HAZADROUS_GAS_DETECTION-main/gas_detection/config.h) tab, and update your WiFi network credentials:
   ```cpp
   #define WIFI_SSID "YOUR_WIFI_SSID"
   #define WIFI_PASS "YOUR_WIFI_PASSWORD"
   ```
5. Select your board (e.g., **ESP32 Dev Module**) and select the appropriate COM Port.
6. Compile and upload the sketch to your ESP32.
7. Open the **Serial Monitor** at **115200** baud rate to see the startup process, clean-air calibration logs, and the assigned **IP Address** once connected to WiFi.

### 2. React Web Dashboard Run
1. Ensure you have **Node.js** (v18 or higher) installed on your computer.
2. Open a terminal and navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the local Vite development server:
   ```bash
   npm run dev
   ```
5. Open your web browser and navigate to the address shown in your terminal (typically `http://localhost:5173`).
6. Click on the **Settings Gear Icon** in the top right corner of the dashboard.
7. Type in the **ESP32 IP Address** (e.g. `192.168.1.15`) printed on the Arduino Serial Monitor and click **Connect & Save**.
8. The dashboard will instantly connect and display real-time gas graphs, statistics, and notification history.

---

## Sensor Calibration Guide

MQ sensors work using an internal heating element and are susceptible to environmental changes. For accurate readings:
1. **Preheating / Burn-in**: The first time you power on new MQ sensors, let them run for 24–48 hours continuously. This clears any manufacturing residues and stabilizes the readings.
2. **Clean Air Calibration**: During boot, the ESP32 performs an auto-calibration cycle (averaging 30 readings). **Ensure the device is powered on in a clean air environment.** This establishes the baseline resistance ($R_0$) for the sensors.
3. **Adjustment**: If you need to align the PPM readings, open [config.h](file:///Users/selvarajks/Downloads/HAZADROUS_GAS_DETECTION-main/gas_detection/config.h) to adjust thresholds, load resistor values (`MQ6_RL_VALUE` / `MQ135_RL_VALUE` which default to $1\text{k}\Omega$ breakout boards), or change the math constants.
