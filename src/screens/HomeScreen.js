import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import useNeckAngle from '../hooks/useNeckAngle';
import AngleGauge from '../components/AngleGauge';
import StatusBadge from '../components/StatusBadge';
import {
  requestNotificationPermissions,
  cancelAllNotifications,
  schedulePostureAlertIn,
  cancelNotificationById,
  addNotificationResponseListener,
} from '../services/NotificationService';
import { getPostureZone } from '../constants/posture';
import { TRACKING_CONFIG } from '../constants/tracking';

export default function HomeScreen() {
  const defaultSettingsDraft = useMemo(
    () => ({
      mildAlertMin: String(Math.round(TRACKING_CONFIG.mildAlertMs / 60000)),
      dangerAlertMin: String(Math.round(TRACKING_CONFIG.dangerAlertMs / 60000)),
      constantSuppressMin: String(Math.round(TRACKING_CONFIG.constantSuppressMs / 60000)),
    }),
    []
  );

  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [nextReminderIn, setNextReminderIn] = useState(0);
  const [isPausedByConstantAngle, setIsPausedByConstantAngle] = useState(false);
  const [sessionStats, setSessionStats] = useState({ totalTime: 0, criticalTime: 0 });
  const [settingsDraft, setSettingsDraft] = useState(defaultSettingsDraft);

  const { angle, zone, isAvailable, sampleTick } = useNeckAngle(isTracking);

  const settings = useMemo(() => {
    const parseNumber = (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    return {
      mildAlertMs: Math.round(
        parseNumber(settingsDraft.mildAlertMin, TRACKING_CONFIG.mildAlertMs / 60000) * 60000
      ),
      dangerAlertMs: Math.round(
        parseNumber(settingsDraft.dangerAlertMin, TRACKING_CONFIG.dangerAlertMs / 60000) * 60000
      ),
      constantSuppressMs: Math.round(
        parseNumber(settingsDraft.constantSuppressMin, TRACKING_CONFIG.constantSuppressMs / 60000) * 60000
      ),
      constantDelta: TRACKING_CONFIG.constantDelta,
    };
  }, [settingsDraft]);

  // Refs for timers (not state — so updates don't cause unnecessary re-renders)
  const countdownIntervalRef = useRef(null);
  const episodeEndTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const stressStartRef = useRef(null);
  const constantStartRef = useRef(null);
  const lastAngleRef = useRef(null);
  const isConstantSuppressedRef = useRef(false);
  const activeStressZoneKeyRef = useRef(null);
  const alertNotificationIdRef = useRef(null);
  const cycleVersionRef = useRef(0);

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

  // ─── Cancel notifications when paused ─────────────────────────────────────
  useEffect(() => {
    if (isPausedByConstantAngle) {
      cancelAllNotifications();
    }
  }, [isPausedByConstantAngle]);

  // ─── Session timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking) {
      sessionTimerRef.current = setInterval(() => {
        setSessionStats((prev) => ({
          ...prev,
          totalTime: prev.totalTime + 1,
          criticalTime:
            zone.key === 'CRITICAL' || zone.key === 'MILD' || zone.key === 'MODERATE'
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
    clearInterval(countdownIntervalRef.current);
    clearTimeout(episodeEndTimerRef.current);
    countdownIntervalRef.current = null;
    episodeEndTimerRef.current = null;
  }, []);

  const clearScheduledStressNotifications = useCallback(async () => {
    await cancelNotificationById(alertNotificationIdRef.current);
    alertNotificationIdRef.current = null;
  }, []);

  const resetStressEpisode = useCallback(() => {
    cycleVersionRef.current += 1;

    const hasActiveStressCycle =
      !!stressStartRef.current ||
      !!episodeEndTimerRef.current ||
      !!activeStressZoneKeyRef.current ||
      !!alertNotificationIdRef.current;

    if (!hasActiveStressCycle) return;

    clearAllTimers();
    setNextReminderIn(0);
    stressStartRef.current = null;
    activeStressZoneKeyRef.current = null;
    void clearScheduledStressNotifications();
  }, [clearAllTimers, clearScheduledStressNotifications]);

  const startStressEpisode = useCallback(
    async (currentZone, delayMs) => {
      if (stressStartRef.current || isConstantSuppressedRef.current) return;

      const now = Date.now();
      const cycleVersion = cycleVersionRef.current;
      stressStartRef.current = now;
      activeStressZoneKeyRef.current = currentZone.key;
      setNextReminderIn(Math.round(delayMs / 1000));

      countdownIntervalRef.current = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - now) / 1000);
        const remaining = Math.max(0, Math.round(delayMs / 1000) - elapsedSec);
        setNextReminderIn(remaining);
      }, 1000);

      episodeEndTimerRef.current = setTimeout(() => {
        if (!isTracking || isConstantSuppressedRef.current) return;
        resetStressEpisode();
      }, delayMs);

      const notificationId = await schedulePostureAlertIn(
        currentZone,
        Math.round(delayMs / 1000),
        'Alert: '
      );

      if (cycleVersion !== cycleVersionRef.current) {
        await cancelNotificationById(notificationId);
        return;
      }

      alertNotificationIdRef.current = notificationId;
    },
    [isTracking, resetStressEpisode]
  );

  // ─── React to angle changes (zone alerts + constant-angle suppression) ────
  useEffect(() => {
    if (!isTracking) return;

    const now = Date.now();
    const isUnchanged =
      lastAngleRef.current != null &&
      Math.abs(angle - lastAngleRef.current) <= settings.constantDelta;

    if (isUnchanged) {
      if (!constantStartRef.current) {
        constantStartRef.current = now;
      } else if (now - constantStartRef.current >= settings.constantSuppressMs) {
        isConstantSuppressedRef.current = true;
        setIsPausedByConstantAngle(true);
        resetStressEpisode();
      }
    } else {
      constantStartRef.current = null;
      isConstantSuppressedRef.current = false;
      setIsPausedByConstantAngle(false);
    }

    lastAngleRef.current = angle;

    if (isConstantSuppressedRef.current) {
      resetStressEpisode();
      return;
    }

    const shouldNotifyMild = zone.key === 'MILD' || zone.key === 'MODERATE';
    const shouldNotifyDanger = zone.key === 'CRITICAL';

    if (!shouldNotifyMild && !shouldNotifyDanger) {
      resetStressEpisode();
      return;
    }

    const alertDelayMs = shouldNotifyDanger ? settings.dangerAlertMs : settings.mildAlertMs;

    if (!stressStartRef.current) {
      void startStressEpisode(zone, alertDelayMs);
      return;
    }

    if (activeStressZoneKeyRef.current !== zone.key) {
      resetStressEpisode();
      void startStressEpisode(zone, alertDelayMs);
    }
  }, [sampleTick, angle, zone, isTracking, startStressEpisode, resetStressEpisode, settings]);

  // ─── Start/Stop tracking ──────────────────────────────────────────────────
  const handleToggleTracking = useCallback(async () => {
    if (isTracking) {
      setIsTracking(false);
      resetStressEpisode();
      cancelAllNotifications();
      constantStartRef.current = null;
      isConstantSuppressedRef.current = false;
      setIsPausedByConstantAngle(false);
      activeStressZoneKeyRef.current = null;
      lastAngleRef.current = null;
    } else {
      setIsTracking(true);
      setSessionStats({ totalTime: 0, criticalTime: 0 });
      setNextReminderIn(0);
      constantStartRef.current = null;
      isConstantSuppressedRef.current = false;
      setIsPausedByConstantAngle(false);
      activeStressZoneKeyRef.current = null;
      lastAngleRef.current = null;
    }
  }, [isTracking, resetStressEpisode]);

  const handleResetSettings = useCallback(() => {
    setSettingsDraft(defaultSettingsDraft);
    resetStressEpisode();
  }, [defaultSettingsDraft, resetStressEpisode]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => resetStressEpisode();
  }, [resetStressEpisode]);

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
            <StatusBadge
              zone={zone}
              nextReminderIn={nextReminderIn}
              isPausedByConstantAngle={isPausedByConstantAngle}
            />
          </View>
        )}

        {/* Zone guide */}
        {!isTracking && (
          <View style={styles.zoneGuide}>
            <Text style={styles.sectionTitle}>Angle Guide</Text>
            {[
              { range: '< 25°', label: 'Good', color: '#00e676', interval: 'no alerts' },
              { range: '25–45°', label: 'Mild', color: '#ffeb3b', interval: 'alert after 5 min' },
              { range: '> 45°', label: 'Danger', color: '#f44336', interval: 'alert after 3 min' },
              { range: 'Same angle 2 min', label: 'Constant Angle', color: '#6c63ff', interval: 'pause counting' },
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

        {/* Prototype settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Prototype Settings</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Mild alert (min)</Text>
            <TextInput
              style={styles.settingInput}
              value={settingsDraft.mildAlertMin}
              onChangeText={(value) => setSettingsDraft((prev) => ({ ...prev, mildAlertMin: value }))}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Danger alert (min)</Text>
            <TextInput
              style={styles.settingInput}
              value={settingsDraft.dangerAlertMin}
              onChangeText={(value) =>
                setSettingsDraft((prev) => ({ ...prev, dangerAlertMin: value }))
              }
              keyboardType="numeric"
              placeholder="3"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Constant angle pause (min)</Text>
            <TextInput
              style={styles.settingInput}
              value={settingsDraft.constantSuppressMin}
              onChangeText={(value) => setSettingsDraft((prev) => ({ ...prev, constantSuppressMin: value }))}
              keyboardType="numeric"
              placeholder="2"
              placeholderTextColor="#666"
            />
          </View>

          <TouchableOpacity
            style={styles.resetSettingsButton}
            onPress={handleResetSettings}
            activeOpacity={0.85}
          >
            <Text style={styles.resetSettingsText}>Reset to defaults</Text>
          </TouchableOpacity>
        </View>

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
              ? `Alerts: mild ${Math.round(settings.mildAlertMs / 60000)} min, danger ${Math.round(settings.dangerAlertMs / 60000)} min. Constant angle pauses after ${Math.round(settings.constantSuppressMs / 60000)} min.`
            : '💡 Hold your phone at eye level while using it — your neck will thank you later!'}
        </Text>
      </ScrollView>
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
  settingsCard: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  settingInput: {
    width: 70,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3d',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center',
    fontWeight: '700',
  },
  resetSettingsButton: {
    marginTop: 4,
    alignSelf: 'flex-end',
    backgroundColor: '#2a2a3d',
    borderWidth: 1,
    borderColor: '#6c63ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetSettingsText: {
    color: '#6c63ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
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
