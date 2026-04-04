// Posture zones — based on neck flexion angle (degrees)
// The phone's tilt from vertical ≈ neck forward flexion angle

export const POSTURE_ZONES = {
  OPTIMAL: {
    key: 'OPTIMAL',
    label: 'Optimal',
    minAngle: 0,
    maxAngle: 25,
    color: '#00e676',       // neon green
    bgColor: '#003d1a',
    reminderMs: 5 * 60 * 1000, // 5 minutes
    emoji: '✅',
    messages: [
      "You're literally glowing rn 🌟 Neck is chef's kiss.",
      "Okay posture queen/king! Take a lil stretch though 🙌",
      "Perfect form fr fr. Your neck thanks you 💪",
      "You ate that posture check bestie. Quick stretch and keep it up!",
      "Neck game strong 💯 Don't forget to look away from your screen for a sec!",
    ],
    overlayTitle: "You're doing great!",
    overlayBody: "Still, ur neck needs a break. Look up and stretch it out real quick 🧘",
  },
  MILD: {
    key: 'MILD',
    label: 'Mild Strain',
    minAngle: 25,
    maxAngle: 35,
    color: '#ffeb3b',       // yellow
    bgColor: '#3d3300',
    reminderMs: 3 * 60 * 1000, // 3 minutes
    emoji: '⚠️',
    messages: [
      "Slight posture check! Tilt your phone up a bit 👀",
      "Heyyy, your neck's taking a little heat. Lift that screen up!",
      "Small fix needed! Bring the phone closer to eye level 📱",
      "Your neck is sending mixed signals lol — fix the angle real quick!",
      "Low-key neck strain detected. Easy fix: just lift your phone up!",
    ],
    overlayTitle: "Posture check!",
    overlayBody: "Your neck's been in a meh position. Bring that phone up to eye level 📱",
  },
  MODERATE: {
    key: 'MODERATE',
    label: 'Moderate Strain',
    minAngle: 35,
    maxAngle: 45,
    color: '#ff9800',       // orange
    bgColor: '#3d1f00',
    reminderMs: 1.5 * 60 * 1000, // 1.5 minutes
    emoji: '😬',
    messages: [
      "Yooo your neck is kinda struggling rn. Fix the angle! 😬",
      "That's a sus phone angle ngl. Lift it up before your neck protests!",
      "Not great, not terrible... but your neck deserves better fr 🙏",
      "Posture SOS! Your neck is carrying like 40 lbs rn. Move the phone up!",
      "Hey! That tilt is giving neck pain energy. Let's fix it 👆",
    ],
    overlayTitle: "Your neck needs help!",
    overlayBody: "You've been tilted for a while. That's like 40+ lbs on your neck rn. Sit up! 💀",
  },
  CRITICAL: {
    key: 'CRITICAL',
    label: 'Critical',
    minAngle: 45,
    maxAngle: Infinity,
    color: '#f44336',       // red
    bgColor: '#3d0000',
    reminderMs: 1 * 60 * 1000, // 1 minute
    emoji: '🚨',
    messages: [
      "BRUH. Your neck is NOT okay right now. Sit up! 🚨",
      "Red alert!! That angle is giving major neck damage vibes. Fix it NOW!",
      "Okay we're in danger zone territory. Lift your phone up ASAP 👆",
      "Your neck is carrying like 60 lbs rn no cap. PLEASE fix your posture!",
      "SOS from your spine 🆘 That angle is actually wild. Sit up straight!",
    ],
    overlayTitle: "NECK EMERGENCY 🚨",
    overlayBody: "Your neck is pulling 60+ lbs rn. That is NOT it. Sit up straight RIGHT NOW!",
  },
};

// Get the zone for a given angle
export function getPostureZone(angle) {
  if (angle < POSTURE_ZONES.OPTIMAL.maxAngle) return POSTURE_ZONES.OPTIMAL;
  if (angle < POSTURE_ZONES.MILD.maxAngle) return POSTURE_ZONES.MILD;
  if (angle < POSTURE_ZONES.MODERATE.maxAngle) return POSTURE_ZONES.MODERATE;
  return POSTURE_ZONES.CRITICAL;
}

// Pick a random message for a zone
export function getRandomMessage(zone) {
  const msgs = zone.messages;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// How long before the 10-minute override pop-up
export const OVERRIDE_POPUP_MS = 10 * 60 * 1000; // 10 minutes
