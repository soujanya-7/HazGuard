#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
// Change these to match your network or set up an AP.
#define WIFI_SSID "OPPO A17k"
#define WIFI_PASS "123456789"

// Pin Configurations
#define MQ6_PIN     34  // Analog pin for MQ-6 (Methane)
#define MQ135_PIN   35  // Analog pin for MQ-135 (Ammonia/Air Quality)
#define BUZZER_PIN  32  // Digital output pin for Buzzer/LED

// Sensor Thresholds (PPM)
#define METHANE_THRESHOLD 1000.0
#define AMMONIA_THRESHOLD 300.0

// ADC Configuration (ESP32)
#define ADC_MAX 4095.0
#define ADC_VOLTAGE 3.3

// Load Resistor values on breakout boards (in Ohms)
// MQ breakout boards typically use a 1k Ohm (1000.0) or 10k Ohm (10000.0) potentiometer/resistor.
// Adjust this value if you measure a different resistance on your board.
#define MQ6_RL_VALUE     1000.0  
#define MQ135_RL_VALUE   1000.0  

// Clean Air Rs/R0 Ratios (from MQ datasheets)
#define MQ6_CLEAN_AIR_FACTOR   10.0   // Rs/R0 ratio of MQ-6 in clean air
#define MQ135_CLEAN_AIR_FACTOR 3.6    // Rs/R0 ratio of MQ-135 in clean air

// PPM Curve Parameters: PPM = A * (Rs/R0)^B
// Derived from datasheet sensitivity curves:
// MQ-6 curve for Methane (CH4)
#define MQ6_CURVE_A 2200.0
#define MQ6_CURVE_B -2.4

// MQ-135 curve for Ammonia (NH3)
#define MQ135_CURVE_A 102.2
#define MQ135_CURVE_B -2.47

// Multi-sampling for ADC stability
#define READ_SAMPLE_INTERVAL 20  // ms between samples
#define READ_SAMPLE_TIMES    10  // number of samples to average

#endif // CONFIG_H
