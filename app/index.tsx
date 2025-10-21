import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import ConnectPanel from '../components/ConnectPanel';

export default function DashboardScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const topPad = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 12;
  const [detectionSystems, setDetectionSystems] = useState<{ id: string; name: string; active: boolean; }[]>([]);
  const defaultSystems = [
    { id: 'human', name: 'Human Detection', active: false },
    { id: 'motion', name: 'Motion Tracking', active: false },
    { id: 'drone', name: 'Drone Detection', active: false },
  ];
  const [espBaseUrl, setEspBaseUrl] = useState('http://192.168.1.123'); // editable
  const SECRET_KEY = 'SENTINEL_KEY'; // must match ESP32
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const [ipInput, setIpInput] = useState('192.168.1.123');
  const xorBytes = (bytes: Uint8Array, key: string) => {
    const keyBytes = new TextEncoder().encode(key);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    return out;
  };
  const [threatsToday, setThreatsToday] = useState(5);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.05] });
  const shieldScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.005] });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${espBaseUrl}/status`);
        const json = await res.json();
        setIsConnected(true);
        if (!isMounted) return;
        if (Array.isArray(json.detections)) {
          setDetectionSystems(json.detections.map((d: any) => ({ id: d.id, name: d.name, active: !!d.active })));
        } else {
          // fallback to boolean fields, if firmware returns individual flags
          const next = [
            { id: 'human', name: 'Human Detection', active: !!json.humanActive },
            { id: 'motion', name: 'Motion Tracking', active: !!json.motionActive },
            { id: 'drone', name: 'Drone Detection', active: !!json.droneActive },
          ];
          if (next.some(i => i.active !== undefined)) setDetectionSystems(next);
        }
        if (typeof json.threatsToday === 'number') setThreatsToday(json.threatsToday);
      } catch (e) {
        // ignore transient errors; keep last known state
        setIsConnected(false);
        setDetectionSystems(prev => prev.map(p => ({ ...p, active: false })));
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { isMounted = false; clearInterval(id); };
  }, [espBaseUrl]);

  // pull encrypted frame occasionally
  useEffect(() => {
    let stop = false;
    const fetchFrame = async () => {
      try {
        const r = await fetch(`${espBaseUrl}/frame`);
        const j = await r.json();
        if (stop) return;
        if (j && typeof j.imageEnc === 'string') {
          const b64 = j.imageEnc as string;
          const raw = atob(b64);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          const dec = xorBytes(bytes, SECRET_KEY);
          // For demo we assume bytes are raw text; if real image bytes (JPEG), build a blob URL instead
          // Here we just show a green dot placeholder when data exists
          setImageDataUrl(`data:text/plain;base64,${b64}`);
        }
      } catch {}
    };
    fetchFrame();
    const t = setInterval(fetchFrame, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [espBaseUrl]);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: topPad, backgroundColor: '#0b1220' }} style={{ backgroundColor: '#0b1220' }}>
      <View style={{ gap: 12, paddingBottom: 16 }}>
        <View style={{ marginBottom: 4 }}>
          <Text style={{ color: '#e5e7eb', fontSize: 18, fontWeight: '700' }}>SentinelPro</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>AI Tactical Defense System</Text>
        </View>
        <View style={{ padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', gap: 12, backgroundColor: '#0f1115', elevation: 2 }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 8, height: 170 }}>
            {/* inner glow */}
            <Animated.View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: isConnected ? '#16a34a' : '#334155', opacity: isConnected ? glowOpacity : 0.05, transform: isConnected ? [{ scale: glowScale }] : [{ scale: 1 }] }} />
            {/* outer ripple */}
            <Animated.View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: isConnected ? 'rgba(34,197,94,0.25)' : 'rgba(51,65,85,0.15)', opacity: isConnected ? glowOpacity : 0.05, transform: isConnected ? [{ scale: glowScale }] : [{ scale: 1 }] }} />
            <Animated.View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: isConnected ? '#16a34a' : '#334155', alignItems: 'center', justifyContent: 'center', transform: isConnected ? [{ scale: shieldScale }] : [{ scale: 1 }] }}>
              <Text style={{ fontSize: 48, color: '#e5e7eb' }}>🛡️</Text>
            </Animated.View>
          </View>
          <Text style={{ color: '#a1a1aa' }}>System Status</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: isConnected ? '#e5e7eb' : '#94a3b8' }}>{isConnected ? 'Active Monitoring' : 'Offline'}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', gap: 6, backgroundColor: '#0f1115', elevation: 1 }}>
            <Text style={{ color: '#a1a1aa' }}>Threats Today</Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#e5e7eb' }}>{isConnected ? threatsToday : 0}</Text>
          </View>
          {/* <View style={{ flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', gap: 10, backgroundColor: '#0f1115', elevation: 1 }}>
            <Text style={{ color: '#a1a1aa' }}>Battery</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' }} />
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#e5e7eb' }}>On</Text>
            </View>
          </View> */}
        </View>

        <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', gap: 10, backgroundColor: '#0f1115', elevation: 1 }}>
          <Text style={{ color: '#a1a1aa' }}>Detection Systems</Text>
          {(isConnected ? detectionSystems : defaultSystems).map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: '#e5e7eb' }}>{item.name}</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: item.active ? '#0b2f1a' : '#1f2937', borderWidth: 1, borderColor: item.active ? '#16a34a' : '#475569' }}>
                <Text style={{ color: item.active ? '#22c55e' : '#cbd5e1', fontWeight: '600' }}>{item.active ? 'Active' : 'Off'}</Text>
              </View>
            </View>
          ))}
          {!isConnected && (
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ color: '#64748b' }}>Not connected to ESP32</Text>
            </View>
          )}
          {imageDataUrl && (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 12 }}>Encrypted image received</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setShowConnectOptions(true)}
          style={{ alignSelf: 'center', marginTop: 16, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#1e40af' }}>
          <Text style={{ color: '#e5e7eb', fontWeight: '700' }}>Connect ESP32-CAM</Text>
        </TouchableOpacity>

        <ConnectPanel
          visible={showConnectOptions}
          initialIp={ipInput}
          onClose={() => setShowConnectOptions(false)}
          onScanBle={() => Alert.alert('Bluetooth', 'Scanning and pairing flow to be implemented')}
          onConnectWiFi={async (ip) => {
            setIpInput(ip);
            const base = `http://${ip}`;
            setEspBaseUrl(base);
            try {
              const res = await fetch(`${base}/status`, { method: 'GET' });
              if (!res.ok) throw new Error('not ok');
              setIsConnected(true);
              setShowConnectOptions(false);
            } catch {
              setIsConnected(false);
              Alert.alert('Connection failed', 'Could not reach ESP32 at the provided IP.');
            }
          }}
        />

      </View>
    </ScrollView>
  );
}



