import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const icsProxyPlugin = {
  name: 'ics-proxy',
  configureServer(server) {
    server.middlewares.use('/ics-proxy', async (req, res) => {
      const raw = req.url?.split('?url=')?.[1];
      if (!raw) { res.statusCode = 400; res.end('Missing url param'); return; }
      const url = decodeURIComponent(raw).replace(/^webcal:\/\//i, 'https://');
      try {
        const upstream = await fetch(url);
        if (!upstream.ok) { res.statusCode = upstream.status; res.end(`Upstream error ${upstream.status}`); return; }
        const text = await upstream.text();
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(text);
      } catch (e) {
        res.statusCode = 502;
        res.end(e.message);
      }
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  server: {
    proxy: {
      '/api': {
        // Dev-server proxy target. Defaults to the LOCAL backend so `npm run dev`
        // never writes into the production database. To point dev at a remote
        // backend (e.g. staging), set VITE_DEV_API_TARGET in your shell, e.g.
        //   VITE_DEV_API_TARGET=https://lead-ops-api-h67zx.ondigitalocean.app npm run dev
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    icsProxyPlugin,
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});