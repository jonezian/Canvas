// Reads configuration from a .env file (if present) and process.env.
// No dependency on dotenv — a tiny parser is enough and keeps the clone
// install-free.
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function loadConfig(root) {
  loadEnvFile(path.join(root, '.env'));

  const baseUrl = process.env.CANVAS_BASE_URL;
  const token = process.env.CANVAS_TOKEN;

  if (!baseUrl || !token) {
    console.error(
      'Missing configuration.\n\n'
      + 'Copy .env.example to .env and fill in:\n'
      + '  CANVAS_BASE_URL=https://<your-institution>.instructure.com\n'
      + '  CANVAS_TOKEN=<your personal access token>\n\n'
      + 'Create a token in Canvas: Account -> Settings -> New Access Token.\n'
      + 'The token is read here only; it is never written to any output file.',
    );
    process.exit(1);
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}
