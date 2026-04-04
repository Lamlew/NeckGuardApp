import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// Messages for the 10-minute no-change overlay
const MESSAGES = [
  {
    headline: "BRUH. 10 MINUTES. 😭",
    body: "You've been in the same bad posture for 10 whole minutes. Your neck is literally crying rn. PUT THE PHONE DOWN and stretch.",
    action: "okay okay I'll fix it 🙏",
  },
  {
    headline: "YOUR NECK IS COOKED 💀",
    body: "10 minutes of bad posture = serious neck stress. Your spine did NOT sign up for this. Sit up straight, bestie.",
    action: "alright alright, fixing it now",
  },
  {
    headline: "SOS FROM YOUR SPINE 🆘",
    body: "Bro. TEN MINUTES. Your neck has been holding mad weight this whole time. Please. Just. Sit. Up.",
    action: "my bad, fixing my posture",
  },
  {
    headline: "NECK CHECK FAILED 🚨",
    body: "10 minutes of the same slouch is genuinely bad for you no cap. Your future self is NOT grateful. Fix it now!",
    action: "I hear you, fixing it 💪",
  },
];

export default function PostureOverlayScreen({ zone, onDismiss }) {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  useEffect(() => {
    // Trigger strong haptic feedback immediately
    const buzz = async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 350);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 700);
      } catch (_) {}
    };
    buzz();

    // Entrance animation
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
    ]).start();

    // Shake animation to draw attention
    const shake = Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]);

    const loop = Animated.loop(shake, { iterations: 3 });
    const timer = setTimeout(() => loop.start(), 300);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
          },
        ]}
      >
        {/* Pulse ring */}
        <View style={styles.pulseRingOuter}>
          <View style={styles.pulseRingInner}>
            <Text style={styles.bigEmoji}>🔴</Text>
          </View>
        </View>

        <Text style={styles.headline}>{msg.headline}</Text>
        <Text style={styles.body}>{msg.body}</Text>

        {/* Neck load visualizer */}
        <View style={styles.loadBar}>
          <Text style={styles.loadLabel}>Neck load right now:</Text>
          <View style={styles.loadTrack}>
            <View style={[styles.loadFill, { width: `${Math.min((zone?.maxAngle || 90) / 90 * 100, 100)}%` }]} />
          </View>
          <Text style={styles.loadValue}>~60+ lbs 😰</Text>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissText}>{msg.action}</Text>
        </TouchableOpacity>

        <Text style={styles.tipText}>
          💡 Tip: Hold your phone at eye level to keep that neck stress low.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.97)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f44336',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  pulseRingOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(244,67,54,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(244,67,54,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigEmoji: {
    fontSize: 34,
  },
  headline: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loadBar: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#2a2a3d',
    borderRadius: 5,
    overflow: 'hidden',
  },
  loadFill: {
    height: '100%',
    backgroundColor: '#f44336',
    borderRadius: 5,
  },
  loadValue: {
    color: '#f44336',
    fontWeight: '700',
    fontSize: 14,
  },
  dismissButton: {
    backgroundColor: '#f44336',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  dismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tipText: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
