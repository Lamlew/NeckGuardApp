import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  AppState,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import useNeckAngle from '../hooks/useNeckAngle';
import AngleGauge from '../components/AngleGauge';
import StatusBadge from '../components/StatusBadge';
import PostureOverlayScreen from './PostureOverlayScreen';
import {
  requestNotificationPermissions,
  sendPostureAlert,
  cancelAllNotifications,
  addNotificationResponseListener,
} from '../services/NotificationService';
import { OVERRIDE_POPUP_MS, getPostureZone } from '../constants/posture';

export default function HomeScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [nextReminderIn, setNextReminderIn] = useState(0);
  const [sessionStats, setSessionStats] = useState({ totalTime: 0, criticalTime: 0 });

  const { angle, zone, isAvailable } = useNeckAngle(isTracking);

  // Refs for timers (not state — so updates don't cause unnecessary re-renders)
  const reminderTimerRef = useRef(null);
  const overrideTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const lastZoneKeyRef = useRef(null);
  const overrideFiredRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ─── Permissions ─────────────────────────────────────────────────────────
  useEffect(() => {
    requestNotificationPermissions().then(setPermissionGranted);
  }, []);

  // ─── Notification tap listener ────────────────────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseListener(() => {
      // If user taps notification, bring them back to app — no extra action needed
    });
    return () => sub.remove();
  }, []);

  // ─── App state (foreground/background) ───────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ─── Session timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking) {
      sessionTimerRef.current = setInterval(() => {
        setSessionStats((prev) => ({
          ...prev,
          totalTime: prev.totalTime + 1,
          criticalTime:
            zone.key === 'CRITICAL' || zone.key === 'MODERATE'
              ? prev.criticalTime + 1
              : prev.criticalTime,
        }));
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
    }
    return () => clearInterval(sessionTimerRef.current);
  }, [isTracking, zone.key]);

  // ─── Clear all timers helper ──────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    clearTimeout(reminderTimerRef.current);
    clearTimeout(overrideTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    reminderTimerRef.current = null;
    overrideTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  // ─── Schedule the next reminder ───────────────────────────────────────────
  const scheduleReminder = useCallback(
    (currentZone) => {
      clearAllTimers();
      overrideFiredRef.current = false;

      const delay = currentZone.reminderMs;
      setNextReminderIn(Math.round(delay / 1000));

      // Countdown ticker
      countdownIntervalRef.current = setInterval(() => {
        setNextReminderIn((prev) => Math.max(prev - 1, 0));
      }, 1000);

      // Reminder fire
      reminderTimerRef.current = setTimeout(async () => {
        await sendPostureAlert(currentZone);
        scheduleReminder(currentZone); // reschedule for same zone
      }, delay);

      // 10-minute override popup (only if hasn't changed zone for 10 min)
      overrideTimerRef.current = setTimeout(() => {
        if (!overrideFiredRef.current) {
          overrideFiredRef.current = true;
          setShowOverlay(true);
        }
      }, OVERRIDE_POPUP_MS);
    },
    [clearAllTimers]
  );

  // ─── React to zone changes ────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) return;

    // Zone changed — reset the 10-min override timer
    if (zone.key !== lastZoneKeyRef.current) {
      lastZoneKeyRef.current = zone.key;
      scheduleReminder(zone);
    }
  }, [zone.key, isTracking, scheduleReminder]);

  // ─── Start/Stop tracking ──────────────────────────────────────────────────
  const handleToggleTracking = useCallback(async () => {
    if (isTracking) {
      setIsTracking(false);
      clearAllTimers();
      cancelAllNotifications();
      lastZoneKeyRef.current = null;
      overrideFiredRef.current = false;
      setNextReminderIn(0);
      setShowOverlay(false);
    } else {
      setIsTracking(true);
      setSessionStats({ totalTime: 0, criticalTime: 0 });
      // Zone-based scheduling starts from the useEffect above
    }
  }, [isTracking, clearAllTimers]);

  // ─── Dismiss overlay ──────────────────────────────────────────────────────
  const handleDismissOverlay = useCallback(() => {
    setShowOverlay(false);
    overrideFiredRef.current = false;
    // Resume scheduling from current zone
    scheduleReminder(zone);
  }, [zone, scheduleReminder]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const goodPercent =
    sessionStats.totalTime > 0
      ? Math.round(((sessionStats.totalTime - sessionStats.criticalTime) / sessionStats.totalTime) * 100)
      : 0;

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>NeckGuard</Text>
          <Text style={styles.tagline}>protect your neck, fr</Text>
        </View>

        {/* Sensor unavailable warning */}
        {!isAvailable && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠️ Motion sensor not found on this device. Try on a real phone!
            </Text>
          </View>
        )}

        {/* Permission warning */}
        {!permissionGranted && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              🔔 Notification permission denied. Alerts won't fire — check your settings!
            </Text>
          </View>
        )}

        {/* Gauge */}
        <View style={styles.gaugeContainer}>
          <AngleGauge angle={isTracking ? angle : 0} zone={isTracking ? zone : getPostureZone(0)} />
          {!isTracking && (
            <Text style={styles.idleText}>Press START to begin tracking</Text>
          )}
        </View>

        {/* Status badge */}
        {isTracking && (
          <View style={styles.section}>
            <StatusBadge zone={zone} nextReminderIn={nextReminderIn} />
          </View>
        )}

        {/* Zone guide */}
        {!isTracking && (
          <View style={styles.zoneGuide}>
            <Text style={styles.sectionTitle}>Angle Guide</Text>
            {[
              { range: '< 25°', label: 'Optimal', color: '#00e676', interval: 'every 5 min' },
              { range: '25–35°', label: 'Mild Strain', color: '#ffeb3b', interval: 'every 3 min' },
              { range: '35–45°', label: 'Moderate', color: '#ff9800', interval: 'every 1:30 min' },
              { range: '> 45°', label: 'Critical', color: '#f44336', interval: 'every 1 min' },
            ].map((z) => (
              <View key={z.label} style={styles.zoneRow}>
                <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                <Text style={styles.zoneRange}>{z.range}</Text>
                <Text style={styles.zoneName}>{z.label}</Text>
                <Text style={styles.zoneInterval}>{z.interval}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Session stats */}
        {isTracking && sessionStats.totalTime > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatTime(sessionStats.totalTime)}</Text>
              <Text style={styles.statLabel}>Session</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#00e676' }]}>{goodPercent}%</Text>
              <Text style={styles.statLabel}>Good Posture</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: zone.color }]}>{angle}°</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
          </View>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.mainButton,
            isTracking ? styles.stopButton : styles.startButton,
          ]}
          onPress={handleToggleTracking}
          activeOpacity={0.85}
        >
          <Text style={styles.mainButtonText}>
            {isTracking ? '⏹  Stop Recording' : '▶  Start Recording'}
          </Text>
        </TouchableOpacity>

        {/* Footer tip */}
        <Text style={styles.footerTip}>
          {isTracking
            ? `Hold your phone at eye level for the best posture ${zone.emoji}`
            : '💡 Hold your phone at eye level while using it — your neck will thank you later!'}
        </Text>
      </ScrollView>

      {/* 10-minute posture override overlay */}
      {showOverlay && (
        <PostureOverlayScreen zone={zone} onDismiss={handleDismissOverlay} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#6c63ff',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  warningCard: {
    backgroundColor: '#2d2000',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  warningText: {
    color: '#ffc107',
    fontSize: 13,
    lineHeight: 20,
  },
  gaugeContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  idleText: {
    color: '#555',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    width: '100%',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  zoneGuide: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoneRange: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    width: 60,
  },
  zoneName: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  zoneInterval: {
    color: '#555',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mainButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startButton: {
    backgroundColor: '#6c63ff',
    shadowColor: '#6c63ff',
  },
  stopButton: {
    backgroundColor: '#2a2a3d',
    borderWidth: 1.5,
    borderColor: '#f44336',
    shadowColor: '#f44336',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerTip: {
    color: '#444',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
});
