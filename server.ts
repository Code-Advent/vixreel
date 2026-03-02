import express from 'express';
import cors from 'cors';
import Mux from '@mux/mux-node';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || '656f9e37-8d1d-4505-af15-5d0c6c7398e2';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || 'k3M3j9uQigy0+9J3JJQeEx+dLiiujqIQYMAIqsxDSzozljOJOHDVMN/REhSbHfGL6c/oDc2sGgC';

const mux = new Mux({
  tokenId: MUX_TOKEN_ID,
  tokenSecret: MUX_TOKEN_SECRET,
});

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Request Logging
  app.use((req, res, next) => {
    console.log(`VixReel: [${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mux API Endpoints
  app.post('/api/live/create', async (req, res) => {
    console.log('VixReel: Received request to create live stream');
    try {
      if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
        throw new Error('Mux API keys are missing in environment');
      }

      const liveStream = await mux.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        test: false,
      });

      console.log('VixReel: Mux stream created successfully:', liveStream.id);

      res.json({
        id: liveStream.id,
        stream_key: liveStream.stream_key,
        playback_id: liveStream.playback_ids?.[0]?.id,
        status: liveStream.status,
      });
    } catch (error: any) {
      console.error('VixReel: Mux Create Stream Error:', error);
      res.status(500).json({ 
        error: error.message,
        details: error.stack
      });
    }
  });

  app.get('/api/live/:id', async (req, res) => {
    try {
      const liveStream = await mux.video.liveStreams.retrieve(req.params.id);
      res.json(liveStream);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/live/:id', async (req, res) => {
    try {
      await mux.video.liveStreams.delete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
