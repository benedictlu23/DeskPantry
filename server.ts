import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

interface OAuthStateEntry {
  redirectUri: string;
  createdAt: number;
}

const oauthStateStore = new Map<string, OAuthStateEntry>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function pruneExpiredOAuthStates() {
  const cutoff = Date.now() - OAUTH_STATE_TTL_MS;
  for (const [key, entry] of oauthStateStore.entries()) {
    if (entry.createdAt < cutoff) {
      oauthStateStore.delete(key);
    }
  }
}

function getOriginFromRequest(req: Request): string {
  const queryOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
  if (queryOrigin && /^https:\/\/[^/]+\.run\.app$/i.test(queryOrigin)) {
    return queryOrigin.replace(/\/+$/, '');
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(appUrl)) {
    return appUrl.replace(/\/+$/, '');
  }

  if (queryOrigin && /^https?:\/\//i.test(queryOrigin)) {
    return queryOrigin.replace(/\/+$/, '');
  }

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : (protoHeader || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function resolveGoogleRedirectUri(req: Request): string {
  const origin = getOriginFromRequest(req);
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) {
    const expanded = configured.replace(/\$\{APP_URL\}/g, origin);
    if (/^https?:\/\//i.test(expanded)) {
      return expanded;
    }
  }
  return `${origin}/auth/google/callback`;
}

function sendOAuthPopupHtml(
  res: Response,
  payload:
    | { type: 'GOOGLE_OAUTH_SUCCESS'; user: { email: string; name: string; avatarUrl: string } }
    | { type: 'GOOGLE_OAUTH_ERROR'; error: string }
) {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const isSuccess = payload.type === 'GOOGLE_OAUTH_SUCCESS';
  const statusHeading = isSuccess ? 'Signed in to DeskPantry' : 'Google Sign-In Issue';
  const statusBody = isSuccess
    ? `Welcome, ${payload.user.name}. Returning to DeskPantry...`
    : payload.error;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${statusHeading}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0B1211; color: #F5F5F4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { max-width: 380px; width: 100%; background: #121D1B; border: 1px solid #233834; border-radius: 16px; padding: 24px; text-align: center; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 14px; color: #A8A29E; margin: 0 0 16px; line-height: 1.5; }
    button { background: #0F766E; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${statusHeading}</h1>
    <p id="msg"></p>
    <button type="button" onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      var payload = ${safeJson};
      document.getElementById('msg').textContent = ${JSON.stringify(statusBody).replace(/</g, '\\u003c')};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
          setTimeout(function() { window.close(); }, 250);
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`);
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  message: string;
  persona?: 'concierge' | 'fast' | 'advisor';
  history?: ChatHistoryItem[];
  context?: {
    userName?: string;
    userRole?: string;
    debtBalance?: number;
    pautanganRate?: number;
    dueDays?: number[];
    catalogSummary?: string;
    pendingProofsCount?: number;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'deskpantry' });
  });

  app.get('/api/auth/google/url', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (
      !clientId ||
      !clientSecret ||
      clientId === 'MY_GOOGLE_CLIENT_ID' ||
      clientSecret === 'MY_GOOGLE_CLIENT_SECRET'
    ) {
      res.status(503).json({
        error: 'Google OAuth credentials are not configured on the server.',
      });
      return;
    }

    pruneExpiredOAuthStates();
    const redirectUri = resolveGoogleRedirectUri(req);
    const state = crypto.randomBytes(24).toString('hex');
    oauthStateStore.set(state, { redirectUri, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });

    res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirectUri,
    });
  });

  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req: Request, res: Response) => {
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    if (oauthError) {
      const desc =
        typeof req.query.error_description === 'string'
          ? req.query.error_description
          : oauthError === 'access_denied'
            ? 'Google sign-in was cancelled.'
            : oauthError;
      sendOAuthPopupHtml(res, { type: 'GOOGLE_OAUTH_ERROR', error: desc });
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code) {
      sendOAuthPopupHtml(res, {
        type: 'GOOGLE_OAUTH_ERROR',
        error: 'Missing authorization code from Google.',
      });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      sendOAuthPopupHtml(res, {
        type: 'GOOGLE_OAUTH_ERROR',
        error: 'Google OAuth credentials are missing on the server.',
      });
      return;
    }

    const stateEntry = state ? oauthStateStore.get(state) : undefined;
    if (state) {
      oauthStateStore.delete(state);
    }
    const redirectUri = stateEntry?.redirectUri ?? resolveGoogleRedirectUri(req);

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        sendOAuthPopupHtml(res, {
          type: 'GOOGLE_OAUTH_ERROR',
          error:
            tokenJson.error_description ||
            tokenJson.error ||
            'Failed to exchange Google authorization code.',
        });
        return;
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });

      const profile = (await profileRes.json()) as {
        email?: string;
        name?: string;
        given_name?: string;
        picture?: string;
      };

      if (!profileRes.ok || !profile.email) {
        sendOAuthPopupHtml(res, {
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Could not retrieve your Gmail profile information.',
        });
        return;
      }

      const displayName =
        profile.name?.trim() ||
        profile.given_name?.trim() ||
        profile.email.split('@')[0];

      sendOAuthPopupHtml(res, {
        type: 'GOOGLE_OAUTH_SUCCESS',
        user: {
          email: profile.email.toLowerCase(),
          name: displayName,
          avatarUrl: profile.picture || '',
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error completing Google sign-in.';
      sendOAuthPopupHtml(res, {
        type: 'GOOGLE_OAUTH_ERROR',
        error: message,
      });
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const body = req.body as ChatRequestBody;
      const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';

      if (!userMessage) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured. Please check your GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const ctx = body.context ?? {};
      const persona = body.persona ?? 'concierge';
      const dueStr = Array.isArray(ctx.dueDays) && ctx.dueDays.length > 0
        ? ctx.dueDays.map((d) => `${d}th`).join(' and ')
        : '15th and 30th';

      const personaDirective =
        persona === 'fast'
          ? 'Role: Quick Stock & Price Assistant. Give ultra-concise, direct 1-3 line answers with exact prices, stock counts, and cutoff dates.'
          : persona === 'advisor'
            ? 'Role: Pautangan & Ledger Advisor. Explain debt balances, GCash/Maya/MariBank proof verification, 15th/30th cutoffs, and monthly interest breakdowns step by step.'
            : 'Role: DeskPantry Concierge. Warmly help coworkers choose snacks, drinks, and coworker marketplace meals (like suman or manok), and navigate DeskPantry features.';

      const selectedModel =
        persona === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

      const systemInstruction = [
        'You are DeskPantry AI, the department office store and community hub assistant.',
        personaDirective,
        'All currency values are in Philippine Pesos (₱).',
        `Current signed-in coworker: ${ctx.userName ?? 'Coworker'} (role: ${ctx.userRole ?? 'member'}).`,
        `Their current store credit (debt) balance is ₱${Number(ctx.debtBalance ?? 0).toFixed(2)}.`,
        `Store debt due dates are on the ${dueStr} of each month. Digital payments (GCash, Maya, MariBank) require uploading a proof-of-payment screenshot for Admin confirmation.`,
        `Pautangan cash assistance monthly interest rate is currently ${ctx.pautanganRate ?? 3}%.`,
        ctx.catalogSummary ? `Current store highlights: ${ctx.catalogSummary}` : '',
        typeof ctx.pendingProofsCount === 'number'
          ? `Pending payment proofs awaiting admin verification: ${ctx.pendingProofsCount}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const historyParts = Array.isArray(body.history)
        ? body.history.slice(-12).map((item) => ({
            role: item.role,
            parts: [{ text: item.text }],
          }))
        : [];

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          ...historyParts,
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        config: {
          systemInstruction,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'The AI assistant returned an empty response.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected server error calling Gemini.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('404') || message.includes('NOT_FOUND')
              ? 404
              : 500;
      res.status(status).json({ error: message });
    }
  });

  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DeskPantry server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DeskPantry server:', err);
  process.exit(1);
});
