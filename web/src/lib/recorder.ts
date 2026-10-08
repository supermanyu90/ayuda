// Microphone capture with MediaRecorder. Audio is held in memory only and
// discarded after it is sent for transcription.

export type MicError = 'unsupported' | 'denied' | 'no_device' | 'failed';

export interface Recording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

const MAX_MS = 30_000;

export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw 'unsupported' satisfies MicError;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const name = (err as DOMException).name;
    throw (name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no_device' : 'failed') satisfies MicError;
  }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  const timer = setTimeout(onAutoStop, MAX_MS);
  const release = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
  };
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = release;
      if (rec.state !== 'inactive') rec.stop();
      else release();
    },
  };
}

export const MIC_MESSAGES: Record<MicError, string> = {
  unsupported: "This browser can't record audio. Please type instead.",
  denied: 'Microphone access was blocked. You can allow it in your browser settings, or just type below.',
  no_device: 'No microphone found. Please type instead.',
  failed: "Couldn't start the microphone. Please type instead.",
};
