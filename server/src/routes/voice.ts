import { Readable } from 'node:stream';
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

export function voiceRoutes({ voice, ai, summaries }: Deps): Router {
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

  // Speaks only a summary this server produced for a recent search (random id, no client text),
  // streamed so the browser starts playing on the first chunk.
  r.get('/speak/:id', limiter(10), async (req, res) => {
    const pending = summaries.get(z.uuid().parse(req.params.id), ai);
    if (!pending) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (!voice.configured) {
      res.status(503).json({ error: 'voice_unavailable', message: 'Spoken replies are unavailable; the text is shown instead.' });
      return;
    }
    const { summary } = await pending;
    const audio = await voice.synthesizeStream(summary);
    res.set({
      'content-type': 'audio/mpeg',
      'cache-control': 'no-store',
      // The web app may be on another origin (Render static site) and plays this via <audio>.
      'cross-origin-resource-policy': 'cross-origin',
    });
    const body = Readable.fromWeb(audio as import('node:stream/web').ReadableStream<Uint8Array>);
    body.on('error', () => res.destroy());
    req.on('close', () => body.destroy());
    body.pipe(res);
  });

  return r;
}
