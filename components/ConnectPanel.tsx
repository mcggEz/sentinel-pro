import React, { useState } from 'react';
import { Platform, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  initialIp?: string;
  onClose: () => void;
  onConnectWiFi: (ip: string) => Promise<void> | void;
  onScanBle: () => void;
};

export default function ConnectPanel({ visible, initialIp = '', onClose, onConnectWiFi, onScanBle }: Props) {
  if (!visible) return null;
  const [ip, setIp] = useState(initialIp);
  const topPad = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999, justifyContent: 'flex-start' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
      />

      <View style={{ marginHorizontal: 16, marginTop: topPad + 8, borderRadius: 14, borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#0f1115', padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: '700' }}>Connect to ESP32‑CAM</Text>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ color: '#94a3b8' }}>Close</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: '#a1a1aa', marginBottom: 8 }}>Wi‑Fi (HTTP)</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: '#94a3b8' }}>IP:</Text>
          <TextInput
            value={ip}
            onChangeText={setIp}
            placeholder="192.168.x.x"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="numeric"
            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', color: '#e5e7eb' }}
          />
          <TouchableOpacity
            onPress={async () => { await onConnectWiFi(ip.trim()); }}
            style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#1e40af', borderRadius: 8 }}>
            <Text style={{ color: '#e5e7eb', fontWeight: '600' }}>Connect</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: '#1f2937', marginVertical: 12 }} />

        <Text style={{ color: '#a1a1aa', marginBottom: 8 }}>Bluetooth (BLE)</Text>
        <TouchableOpacity onPress={onScanBle} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#0b3a2e', borderRadius: 8, alignSelf: 'flex-start' }}>
          <Text style={{ color: '#22c55e', fontWeight: '600' }}>Scan Devices</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


