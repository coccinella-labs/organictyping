// SPDX-License-Identifier: BSD-3-Clause
import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import escapeHtml from 'escape-html';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import { Octokit } from '@octokit/rest';
import { App } from '@octokit/app';
import { kv } from '@vercel/kv';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { Keystroke } from '../../core/collector/keylogger';
import { normalizeKeystrokes } from '../../core/processor/normalize';
import { calculateStats } from '../../core/processor/stats';

type PR = {
  title: string;
  body: string;
  user: { login: string };
  number: number;
};

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Encryption key for data at rest (use a secure password in ENCRYPTION_KEY and salt in ENCRYPTION_SALT)
const encryptionKeyEnv = process.env.ENCRYPTION_KEY;
if (!encryptionKeyEnv)
  throw new Error('ENCRYPTION_KEY environment variable must be set');
const salt = process.env.ENCRYPTION_SALT;
if (!salt) throw new Error('ENCRYPTION_SALT environment variable must be set');
const ENCRYPTION_KEY = crypto.scryptSync(encryptionKeyEnv, salt, 32);
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Rate limiting for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for API
  message: 'Too many API requests from this IP, please try again later.',
});

app.use('/webhook', webhookLimiter);
app.use('/api', apiLimiter);

// Middleware for API authentication (simple token check as MFA placeholder)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  if (
    token.length !== apiSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiSecret))
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// CORS for API endpoints
app.use('/api', cors({ origin: ['https://github.com'] }));

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY;

if (!appId || !privateKey) {
  throw new Error(
    'GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set in environment variables.'
  );
}

if (!process.env.API_SECRET) {
  throw new Error('API_SECRET must be set in environment variables.');
}

const apiSecret = process.env.API_SECRET as string;

const githubApp = new App({
  appId,
  privateKey,
});

function textToKeystrokes(text: string | null): Keystroke[] {
  const keystrokes: Keystroke[] = [];
  let time = 0;
  for (const char of text || '') {
    keystrokes.push({ key: char, timestamp: time, type: 'press' });
    time += 100; // Simulate 100ms per character
  }
  return keystrokes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePullRequest(event: any, isUpdate: boolean) {
  const installationId = event.payload.installation?.id;
  if (!installationId) {
    console.error('Installation ID not found in webhook payload.');
    return;
  }
  const octokit = await githubApp.getInstallationOctokit(installationId);
  const pr = event.payload.pull_request as PR;
  const body = pr.body;

  const keystrokes = textToKeystrokes(body);
  const normalized = normalizeKeystrokes(keystrokes);
  const stats = calculateStats(normalized);

  // Encode stats using Python model
  const statsJson = JSON.stringify(stats);
  const encodedVector = JSON.parse(
    execSync(`python3 core/model/organic-encoder.py`, {
      input: statsJson,
      encoding: 'utf-8',
    })
      .toString()
      .trim()
  );

  // Verify using Python model
  const vectorJson = JSON.stringify(encodedVector);
  const verification = execSync(`python3 core/model/verifier.py`, {
    input: vectorJson,
    encoding: 'utf-8',
  })
    .toString()
    .trim();

  // Update signature atomically (encrypted)
  const userLogin = pr.user.login;
  const encryptedStats = encrypt(JSON.stringify(stats));
  await kv.hset('signatures', { [userLogin]: encryptedStats });
  console.log(
    `AUDIT: Signature updated for user ${escapeHtml(userLogin)} at ${new Date().toISOString()}`
  );

  const analysis = `Average Interval: ${stats.averageInterval.toFixed(2)}ms, Pauses: ${stats.pauseCount}, Rhythm: ${stats.rhythmVector.join(', ')}, Verification: ${verification}`;
  const commentBody = isUpdate
    ? `Organic Typing Analysis (updated):\n${analysis}\nSignature updated for user ${escapeHtml(userLogin)}.`
    : `Organic Typing Analysis:\n${analysis}\nSignature stored for user ${escapeHtml(userLogin)}.`;

  await (octokit as Octokit).issues.createComment({
    owner: event.payload.repository.owner.login,
    repo: event.payload.repository.name,
    issue_number: pr.number,
    body: commentBody,
  });
}

const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET || 'development',
});

webhooks.on('pull_request.opened', (event) => handlePullRequest(event, false));
webhooks.on('pull_request.edited', (event) => handlePullRequest(event, true));

app.use(createNodeMiddleware(webhooks, { path: '/webhook' }));

app.get('/', (req: Request, res: Response) => {
  res.send('Organic Typing GitHub App');
});

app.get('/favicon.ico', (req: Request, res: Response) => {
  res.status(204).end(); // No content for favicon
});

app.get('/favicon.png', (req: Request, res: Response) => {
  res.status(204).end(); // No content for favicon
});

// Endpoint for consent
app.post('/api/consent', async (req: Request, res: Response) => {
  const { userId, consent } = req.body;
  // store one-line consent record: { userId, consent, ts }
  await kv.hset('consent', { [userId]: { consent, ts: Date.now() } });
  console.log(
    `AUDIT: Consent updated for user ${escapeHtml(userId)} from IP ${req.ip} at ${new Date().toISOString()}`
  );
  res.sendStatus(204);
});

// Endpoint for data export
app.post('/api/export', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  // return aggregated vectors only (decrypted)
  const encryptedVectors = await kv.hget('signatures', userId);
  if (encryptedVectors) {
    const decryptedVectors = JSON.parse(decrypt(encryptedVectors as string));
    console.log(
      `AUDIT: Data exported for user ${escapeHtml(userId)} from IP ${req.ip} at ${new Date().toISOString()}`
    );
    res.json({ exportedAt: Date.now(), vectors: decryptedVectors });
  } else {
    console.log(
      `AUDIT: Export attempted for user ${escapeHtml(userId)} from IP ${req.ip} but no data found at ${new Date().toISOString()}`
    );
    res.status(404).json({ error: 'No data found' });
  }
});

// Endpoint for data deletion
app.delete(
  '/api/delete/:user',
  requireAuth,
  async (req: Request, res: Response) => {
    const user = req.params.user;
    try {
      await kv.hdel('signatures', user);
      await kv.hdel('consent', user);
      console.log(
        `AUDIT: Data deleted for user ${escapeHtml(user)} from IP ${req.ip} at ${new Date().toISOString()}`
      );
      res.send(`Data for user ${escapeHtml(user)} deleted.`);
    } catch (error) {
      console.log(
        `AUDIT: Error deleting data for user ${escapeHtml(user)} from IP ${req.ip} at ${new Date().toISOString()}: ${error}`
      );
      res.status(500).send('Error deleting data.');
    }
  }
);

// For Vercel serverless
export default app;

// For local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
