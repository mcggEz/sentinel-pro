#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <mbedtls/base64.h>

// ---------- Wi-Fi ----------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------- Pins (adjust to your board) ----------
const int PIN_BUZZER     = 14;
const int PIN_VIBRATION  = 27;
const int PIN_LED        = 26;

// ---------- State ----------
bool isConnected = true;
int batteryLevel = 73;
int threatsToday = 5;
bool humanActive = true;
bool motionActive = true;
bool droneActive = false;

// simple XOR key for demo; replace with stronger crypto if needed
const char* SECRET_KEY = "SENTINEL_KEY";

struct DeviceSettings {
  bool buzzerEnabled = true;
  bool vibrationEnabled = true;
  bool ledEnabled = true;
  int sensitivity = 70; // 0..100
} deviceSettings;

// Mock alert data
struct Alert {
  const char* id;
  const char* type;       // "human" | "drone" | "motion"
  const char* timestamp;
  int confidence;
  const char* location;
  const char* status;     // "active" | "investigating" | "cleared"
};

Alert alerts[] = {
  { "1", "human", "Today at 14:23", 94, "Sector A-2", "active" },
  { "2", "drone", "Today at 13:45", 87, "Sector B-1", "investigating" },
  { "3", "motion", "Today at 12:10", 76, "Sector A-3", "cleared" },
  { "4", "human", "Today at 11:34", 91, "Sector C-4", "cleared" },
  { "5", "motion", "Today at 10:55", 68, "Sector A-1", "cleared" },
};

WebServer server(80);

// ---------- Helpers ----------
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void applyOutputs() {
  digitalWrite(PIN_BUZZER, deviceSettings.buzzerEnabled ? HIGH : LOW);
  digitalWrite(PIN_VIBRATION, deviceSettings.vibrationEnabled ? HIGH : LOW);
  digitalWrite(PIN_LED, deviceSettings.ledEnabled ? HIGH : LOW);
}

// ---------- Handlers ----------
void handleOptions() {
  setCorsHeaders();
  server.send(204); // No Content
}

void handleStatus() {
  setCorsHeaders();
  StaticJsonDocument<768> doc;
  doc["isActive"] = isConnected;
  doc["batteryLevel"] = batteryLevel;
  doc["threatsToday"] = threatsToday;
  doc["systemStatus"] = isConnected ? "online" : "offline";
  // preferred shape
  JsonArray detections = doc.createNestedArray("detections");
  JsonObject h = detections.createNestedObject(); h["id"] = "human"; h["name"] = "Human Detection"; h["active"] = humanActive;
  JsonObject m = detections.createNestedObject(); m["id"] = "motion"; m["name"] = "Motion Tracking"; m["active"] = motionActive;
  JsonObject d = detections.createNestedObject(); d["id"] = "drone"; d["name"] = "Drone Detection"; d["active"] = droneActive;
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleAlerts() {
  setCorsHeaders();
  StaticJsonDocument<1024> doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& a : alerts) {
    JsonObject o = arr.createNestedObject();
    o["id"] = a.id;
    o["type"] = a.type;
    o["timestamp"] = a.timestamp;
    o["confidence"] = a.confidence;
    o["location"] = a.location;
    o["status"] = a.status;
  }
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleSettingsPost() {
  setCorsHeaders();
  if (server.hasArg("plain") == false) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc.containsKey("buzzerEnabled")) {
    deviceSettings.buzzerEnabled = doc["buzzerEnabled"].as<bool>();
  }
  if (doc.containsKey("vibrationEnabled")) {
    deviceSettings.vibrationEnabled = doc["vibrationEnabled"].as<bool>();
  }
  if (doc.containsKey("ledEnabled")) {
    deviceSettings.ledEnabled = doc["ledEnabled"].as<bool>();
  }
  if (doc.containsKey("sensitivity")) {
    int s = doc["sensitivity"].as<int>();
    deviceSettings.sensitivity = constrain(s, 0, 100);
  }

  applyOutputs();

  StaticJsonDocument<256> res;
  res["ok"] = true;
  res["buzzerEnabled"] = deviceSettings.buzzerEnabled;
  res["vibrationEnabled"] = deviceSettings.vibrationEnabled;
  res["ledEnabled"] = deviceSettings.ledEnabled;
  res["sensitivity"] = deviceSettings.sensitivity;
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleConnect() {
  setCorsHeaders();
  isConnected = true;
  server.send(200, "application/json", "{\"ok\":true,\"isConnected\":true}");
}

void handleDisconnect() {
  setCorsHeaders();
  isConnected = false;
  // Optionally disable outputs when disconnected
  server.send(200, "application/json", "{\"ok\":true,\"isConnected\":false}");
}

void handleNotFound() {
  setCorsHeaders();
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

// --- demo frame endpoint: returns XOR-encrypted bytes as base64 ---
void handleFrame() {
  setCorsHeaders();
  // demo payload (not a real image): replace with camera bytes when available
  const uint8_t demoBytes[] = { 'S','e','n','t','i','n','e','l','P','r','o' };
  const size_t demoLen = sizeof(demoBytes);
  const char* key = SECRET_KEY;
  const size_t keyLen = strlen(key);

  // XOR encrypt into buffer
  uint8_t enc[demoLen];
  for (size_t i = 0; i < demoLen; ++i) enc[i] = demoBytes[i] ^ key[i % keyLen];

  // base64 encode
  size_t outLen = 0; // will be set by encoder
  // calculate needed length
  mbedtls_base64_encode(NULL, 0, &outLen, enc, demoLen);
  char* b64 = (char*)malloc(outLen + 1);
  if (!b64) { server.send(500, "application/json", "{\"error\":\"oom\"}"); return; }
  if (mbedtls_base64_encode((unsigned char*)b64, outLen, &outLen, enc, demoLen) != 0) { free(b64); server.send(500, "application/json", "{\"error\":\"b64\"}"); return; }
  b64[outLen] = '\0';

  StaticJsonDocument<256> doc;
  doc["algo"] = "xor";
  doc["keyId"] = "default";
  doc["imageEnc"] = b64;
  String out;
  serializeJson(doc, out);
  free(b64);
  server.send(200, "application/json", out);
}

// ---------- Setup ----------
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_VIBRATION, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  applyOutputs();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected, IP: ");
  Serial.println(WiFi.localIP());

  // Routes
  server.on("/", HTTP_GET, []() {
    setCorsHeaders();
    server.send(200, "text/plain", "SentinelPro ESP32 online");
  });

  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/status", HTTP_GET, handleStatus);

  server.on("/alerts", HTTP_OPTIONS, handleOptions);
  server.on("/alerts", HTTP_GET, handleAlerts);

  server.on("/settings", HTTP_OPTIONS, handleOptions);
  server.on("/settings", HTTP_POST, handleSettingsPost);

  server.on("/connect", HTTP_OPTIONS, handleOptions);
  server.on("/connect", HTTP_POST, handleConnect);

  server.on("/disconnect", HTTP_OPTIONS, handleOptions);
  server.on("/disconnect", HTTP_POST, handleDisconnect);

  server.on("/frame", HTTP_OPTIONS, handleOptions);
  server.on("/frame", HTTP_GET, handleFrame);

  server.onNotFound(handleNotFound);

  server.begin();
}

// ---------- Loop ----------
void loop() {
  server.handleClient();
  // You could update batteryLevel/threatsToday here on an interval if needed
}