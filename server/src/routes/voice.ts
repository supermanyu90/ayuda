import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { limiter } from '../middleware/security.js';
import type { Deps } from '../app.js';

const ALLOWED_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac'];

// Memory storage only: raw audio is never written to disk or the database.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_AUDIO.includes(file.mimetype.split(';')[0]!)),
});

export function voiceRoutes({ voice, speech }: Deps): Router {
  const r = Router();

  r.post('/transcribe', limiter(10), upload.single('audio'), async (req, res) => {
    if (!voice.configured) {
      res.status(503).json({ error: 'voice_unavailable', message: 'Voice is not available right now. Please type instead.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'invalid_audio', message: 'Please send a short audio recording (max 2 MB).' });
      return;
    }
    const { text, language } = await voice.transcribe(req.file.buffer, req.file.mimetype.split(';')[0]!);
    req.file.buffer.fill(0);
    if (!text) {
      res.status(422).json({ error: 'empty_transcript', message: "I didn't catch that. Please try again or type instead." });
      return;
    }
    res.json({ text: text.slice(0, 600), language });
  });

  // Only speaks summaries this server produced (speech_token from /api/match).
  r.post('/speak', limiter(10), async (req, res) => {
    const { text, token } = z.object({ text: z.string().min(1).max(400), token: z.string().max(200) }).strict().parse(req.body);
    if (!speech.verify(text, token)) {
      res.status(403).json({ error: 'invalid_speech_token' });
      return;
    }
    if (!voice.configured) {
      res.status(503).json({ error: 'voice_unavailable', message: 'Spoken replies are unavailable; the text is shown instead.' });
      return;
    }
    const audio = await voice.synthesize(text);
    res.set({ 'content-type': 'audio/mpeg', 'cache-control': 'no-store' }).send(audio);
  });

  return r;
}
