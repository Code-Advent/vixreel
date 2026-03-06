import express from 'express';
import cors from 'cors';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGORA_APP_ID = process.env.VITE_AGORA_APP_ID || '39f712e5cf114fc084d9265e8987bbe6';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '494a1eaabbd9424aa6fb1ef28601a60b';

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Request Logging
  app.use((req, res, next) => {
    console.log(`VixReel: [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Agora Token Generation
  app.post('/api/live/create', (req, res) => {
    console.log('VixReel: [CREATE_AGORA_TOKEN] Processing request...');
    try {
      const channelName = req.body.channelName || `channel_${Math.floor(Math.random() * 1000000)}`;
      const uid = req.body.uid || 0;
      const role = RtcRole.PUBLISHER;
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        uid,
        role,
        privilegeExpiredTs
      );

      console.log('VixReel: [CREATE_AGORA_TOKEN] SUCCESS for channel:', channelName);

      res.json({
        token,
        channelName,
        appId: AGORA_APP_ID,
        uid
      });
    } catch (error: any) {
      console.error('VixReel: [CREATE_AGORA_TOKEN] ERROR:', error);
      res.status(500).json({ error: error.message || 'Failed to generate Agora token' });
    }
  });

  app.post('/api/live/token', (req, res) => {
    const { channelName, uid, role: roleStr } = req.body;
    if (!channelName) return res.status(400).json({ error: 'channelName is required' });

    try {
      const role = roleStr === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        uid || 0,
        role,
        privilegeExpiredTs
      );

      res.json({ token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/live/:id', async (req, res) => {
    // Legacy endpoint for compatibility
    res.json({ status: 'active', provider: 'agora' });
  });

  app.delete('/api/live/:id', async (req, res) => {
    // Legacy endpoint for compatibility
    res.json({ success: true });
  });

  // API Catch-all (to distinguish from Vite 404s)
  app.all('/api/*', (req, res) => {
    console.warn(`VixReel: [API_404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('VixReel: Uncaught Server Error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message,
      path: req.path
    });
  });

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VixReel Server running on http://localhost:${PORT}`);
  });
}

startServer();
