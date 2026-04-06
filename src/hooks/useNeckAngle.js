import { useState, useEffect, useRef, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import { getPostureZone } from '../constants/posture';

const SMOOTHING_SAMPLES = 8; // Number of samples to average for smoother readings
const UPDATE_INTERVAL_MS = 200; // How often to sample the accelerometer (ms)

/**
 * Calculates the neck angle from accelerometer data.
 *
 * The angle is measured from vertical (phone held straight up = 0°).
 * As the user tilts the phone forward to look down, the angle increases.
 * This correlates with cervical flexion (neck bend) angle.
 *
 * Physics: angle = atan2(|z|, |y|) in portrait mode
 *   - Phone vertical (upright): y ≈ -1, z ≈ 0  → angle ≈ 0°
 *   - Phone at 45°:             y ≈ -0.7, z ≈ ±0.7 → angle ≈ 45°
 *   - Phone horizontal (flat):  y ≈ 0,  z ≈ ±1  → angle ≈ 90°
 */
function computeAngle({ x, y, z }) {
  // Use atan2 with the absolute z component vs y magnitude
  // We care about pitch (forward tilt), ignoring roll (side tilt)
  const angleRad = Math.atan2(Math.abs(z), Math.abs(y));
  return (angleRad * 180) / Math.PI;
}

export default function useNeckAngle(isTracking) {
  const [angle, setAngle] = useState(0);
  const [zone, setZone] = useState(getPostureZone(0));
  const [isAvailable, setIsAvailable] = useState(true);
  const [sampleTick, setSampleTick] = useState(0);

  const samplesRef = useRef([]);
  const subscriptionRef = useRef(null);

  const processReading = useCallback((data) => {
    const newAngle = computeAngle(data);

    // Keep a rolling window of samples for smoothing
    samplesRef.current.push(newAngle);
    if (samplesRef.current.length > SMOOTHING_SAMPLES) {
      samplesRef.current.shift();
    }

    // Compute smoothed average
    const avg =
      samplesRef.current.reduce((sum, v) => sum + v, 0) /
      samplesRef.current.length;

    const smoothed = Math.round(avg);
    setAngle(smoothed);
    setZone(getPostureZone(smoothed));
    setSampleTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function startTracking() {
      const available = await Accelerometer.isAvailableAsync();
      if (!mounted) return;

      if (!available) {
        setIsAvailable(false);
        return;
      }

      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscriptionRef.current = Accelerometer.addListener(processReading);
    }

    if (isTracking) {
      startTracking();
    } else {
      // Stop listening when not tracking
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      samplesRef.current = [];
    }

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [isTracking, processReading]);

  return { angle, zone, isAvailable, sampleTick };
}
