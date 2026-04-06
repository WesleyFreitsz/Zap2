const SAMPLE_RATE = 44100;

const SOUND_DEFINITIONS = {
  classic: {
    label: "Clássico",
    description: "Dois toques curtos e nítidos.",
    segments: [
      { frequency: 880, duration: 0.08, volume: 0.55, type: "sine" },
      { frequency: 0, duration: 0.025, volume: 0, type: "sine" },
      { frequency: 1320, duration: 0.11, volume: 0.5, type: "triangle" },
    ],
  },
  soft: {
    label: "Suave",
    description: "Toque leve para ambientes mais silenciosos.",
    segments: [
      { frequency: 660, duration: 0.12, volume: 0.3, type: "triangle" },
      { frequency: 990, duration: 0.12, volume: 0.24, type: "sine" },
    ],
  },
  digital: {
    label: "Digital",
    description: "Som mais eletrônico e destacado.",
    segments: [
      { frequency: 1046, duration: 0.05, volume: 0.45, type: "square" },
      { frequency: 784, duration: 0.05, volume: 0.38, type: "square" },
      { frequency: 1174, duration: 0.08, volume: 0.42, type: "square" },
    ],
  },
  none: {
    label: "Silencioso",
    description: "Desativa o som de notificação.",
    segments: [],
  },
};

export const DEFAULT_NOTIFICATION_SOUND = "classic";

export const NOTIFICATION_SOUND_OPTIONS = Object.entries(SOUND_DEFINITIONS).map(
  ([id, config]) => ({
    id,
    label: config.label,
    description: config.description,
  }),
);

const soundUrlCache = new Map();

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function getWaveSample(type, frequency, time) {
  if (!frequency) return 0;
  const angle = 2 * Math.PI * frequency * time;

  switch (type) {
    case "square":
      return Math.sign(Math.sin(angle));
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(angle));
    default:
      return Math.sin(angle);
  }
}

function getEnvelope(sampleIndex, totalSamples) {
  const attackSamples = Math.max(1, Math.floor(totalSamples * 0.12));
  const releaseSamples = Math.max(1, Math.floor(totalSamples * 0.2));

  if (sampleIndex < attackSamples) {
    return sampleIndex / attackSamples;
  }

  if (sampleIndex > totalSamples - releaseSamples) {
    return Math.max(0, (totalSamples - sampleIndex) / releaseSamples);
  }

  return 1;
}

function createWavUrl(segments) {
  const totalSamples = segments.reduce(
    (sum, segment) => sum + Math.max(1, Math.floor(segment.duration * SAMPLE_RATE)),
    0,
  );

  if (!totalSamples) return null;

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  const byteRate = SAMPLE_RATE * 2;
  const blockAlign = 2;
  const dataSize = totalSamples * 2;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let sampleCursor = 0;
  segments.forEach((segment) => {
    const segmentSamples = Math.max(1, Math.floor(segment.duration * SAMPLE_RATE));

    for (let sampleIndex = 0; sampleIndex < segmentSamples; sampleIndex += 1) {
      const time = sampleIndex / SAMPLE_RATE;
      const envelope = getEnvelope(sampleIndex, segmentSamples);
      const amplitude =
        getWaveSample(segment.type, segment.frequency, time) *
        (segment.volume || 0) *
        envelope;

      view.setInt16(44 + sampleCursor * 2, Math.max(-1, Math.min(1, amplitude)) * 0x7fff, true);
      sampleCursor += 1;
    }
  });

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export function getNotificationSoundUrl(soundId) {
  const key = SOUND_DEFINITIONS[soundId] ? soundId : DEFAULT_NOTIFICATION_SOUND;
  if (key === "none") return null;

  if (!soundUrlCache.has(key)) {
    soundUrlCache.set(key, createWavUrl(SOUND_DEFINITIONS[key].segments));
  }

  return soundUrlCache.get(key) || null;
}
