# NeckGuard 📱

A teen-friendly React Native app that tracks your phone angle and reminds you to fix your posture before your neck pays the price.

## How it Works

The app uses your phone's gyroscope and accelerometer to estimate how far you're tilting your head down. That angle maps directly to neck stress (cervical flexion load).

| Angle       | Zone         | Reminder Interval | Neck Load   |
|-------------|--------------|-------------------|-------------|
| < 25°       | ✅ Optimal    | Every 5 min       | ~10–20 lbs  |
| 25° – 35°   | ⚠️ Mild       | Every 3 min       | ~27–40 lbs  |
| 35° – 45°   | 😬 Moderate   | Every 1:30 min    | ~40–49 lbs  |
| > 45°       | 🚨 Critical   | Every 1 min       | ~50–60+ lbs |

If you stay in the **same bad posture for 3 minutes**, a push notification will remind you to fix your posture with teen-friendly messages.

---

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS or Android)

### Install & Run

```bash
cd NeckGuard
npm install
npx expo start
```

Then scan the QR code with Expo Go on your phone.

### Build for Production (optional)
```bash
npx eas build --platform android   # or ios
```

---

## App Structure

```
NeckGuard/
├── App.js                          # Root component, navigation
├── app.json                        # Expo config (permissions, plugins)
├── src/
│   ├── constants/
│   │   └── posture.js              # Angle zones, messages, thresholds
│   ├── services/
│   │   └── NotificationService.js  # Notifications + haptics
│   ├── hooks/
│   │   └── useNeckAngle.js         # Accelerometer → smoothed angle
│   ├── screens/
│   │   ├── HomeScreen.js           # Main UI: gauge, controls, stats
│   │   └── PostureOverlayScreen.js # 10-min override full-screen alert
│   └── components/
│       ├── AngleGauge.js           # SVG speedometer-style gauge
│       └── StatusBadge.js          # Zone + countdown timer badge
```

---

## Notes

- **Background tracking**: On Android, tracking persists in the background via the foreground task. On iOS, background sensor access is OS-limited — keep the screen on for best results, or scheduled notifications will fire as reminders.
- **Angle calibration**: The angle is measured from vertical. Hold your phone the way you normally would — the app auto-detects your tilt.


It is designed for fast iteration and testing, with editable in-app timing settings.
