import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';

const SIZE = 220;
const STROKE_WIDTH = 16;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Angle zones for the arc coloring (0° to 90° mapped to 0% to 100%)
const ZONE_SEGMENTS = [
  { start: 0, end: 25, color: '#00e676' },    // optimal
  { start: 25, end: 35, color: '#ffeb3b' },   // mild
  { start: 35, end: 45, color: '#ff9800' },   // moderate
  { start: 45, end: 90, color: '#f44336' },   // critical
];

// Arc goes from 225° to -45° (a 270° sweep) like a speedometer
const ARC_START_DEG = 225;
const ARC_SWEEP_DEG = 270;
const MAX_ANGLE = 90;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function getPointOnCircle(angleDeg) {
  const rad = degToRad(angleDeg);
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER + RADIUS * Math.sin(rad),
  };
}

function buildArcPath(startDeg, endDeg) {
  const p1 = getPointOnCircle(startDeg);
  const p2 = getPointOnCircle(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

// Convert neck angle (0-90) to arc degrees
function neckAngleToArcDeg(neckAngle) {
  const clamped = Math.min(Math.max(neckAngle, 0), MAX_ANGLE);
  const fraction = clamped / MAX_ANGLE;
  return ARC_START_DEG + fraction * ARC_SWEEP_DEG;
}

export default function AngleGauge({ angle, zone }) {
  const animatedAngle = useRef(new Animated.Value(angle)).current;
  const displayAngle = useRef(angle);

  useEffect(() => {
    Animated.spring(animatedAngle, {
      toValue: angle,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
    displayAngle.current = angle;
  }, [angle]);

  // Build track arcs for each zone
  const trackArcs = ZONE_SEGMENTS.map((seg) => {
    const startArc = neckAngleToArcDeg(seg.start);
    const endArc = neckAngleToArcDeg(Math.min(seg.end, MAX_ANGLE));
    return { ...seg, path: buildArcPath(startArc, endArc) };
  });

  // Needle position
  const needleArcDeg = neckAngleToArcDeg(angle);
  const needlePoint = getPointOnCircle(needleArcDeg);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background track */}
        {trackArcs.map((arc, i) => (
          <Path
            key={i}
            d={arc.path}
            stroke={arc.color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeOpacity={0.25}
            strokeLinecap="round"
          />
        ))}

        {/* Active filled arc from start to current angle */}
        {(() => {
          const endArc = neckAngleToArcDeg(Math.min(angle, MAX_ANGLE));
          const path = buildArcPath(ARC_START_DEG, endArc);
          return (
            <Path
              d={path}
              stroke={zone.color}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
            />
          );
        })()}

        {/* Needle dot */}
        <Circle
          cx={needlePoint.x}
          cy={needlePoint.y}
          r={10}
          fill={zone.color}
        />
        <Circle
          cx={needlePoint.x}
          cy={needlePoint.y}
          r={6}
          fill="#0f0f1a"
        />

        {/* Center hub */}
        <Circle cx={CENTER} cy={CENTER} r={6} fill="#2a2a3d" />

        {/* Zone labels */}
        <SvgText x={16} y={SIZE - 8} fill="#00e676" fontSize="10" fontWeight="600">0°</SvgText>
        <SvgText x={CENTER - 8} y={22} fill="#ffeb3b" fontSize="10" fontWeight="600">45°</SvgText>
        <SvgText x={SIZE - 30} y={SIZE - 8} fill="#f44336" fontSize="10" fontWeight="600">90°</SvgText>
      </Svg>

      {/* Center angle readout */}
      <View style={styles.readout} pointerEvents="none">
        <Text style={[styles.angleText, { color: zone.color }]}>{angle}°</Text>
        <Text style={styles.zoneLabel}>{zone.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: {
    position: 'absolute',
    alignItems: 'center',
    top: CENTER + 20,
  },
  angleText: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  zoneLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
