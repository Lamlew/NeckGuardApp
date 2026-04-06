import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatusBadge({ zone, nextReminderIn, isPausedByConstantAngle = false }) {
  const minutes = Math.floor(nextReminderIn / 60);
  const seconds = nextReminderIn % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={[styles.badge, { borderColor: zone.color, backgroundColor: zone.bgColor }]}>
      <Text style={styles.emoji}>{zone.emoji}</Text>
      <View style={styles.textBlock}>
        <Text style={[styles.status, { color: zone.color }]}>{zone.label}</Text>
        <Text style={styles.timer}>
          {isPausedByConstantAngle
            ? 'Paused: constant angle detected'
            : <>Next alert in <Text style={{ color: zone.color, fontWeight: '700' }}>{timeStr}</Text></>}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    width: '100%',
  },
  emoji: {
    fontSize: 28,
  },
  textBlock: {
    flex: 1,
  },
  status: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timer: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});
