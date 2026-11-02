// The build Vercel runs (vercel.json buildCommand, which Vercel caps at 256
// characters). A malformed results snapshot fails the deploy. The Retrieval
// page ships its demo hidden, and the build opens it only when RETRIEVAL_DEMO
// is `on`, so the demo is switched in Vercel's environment with no code change.
import * as fs from 'fs';
import { parseSnapshot } from './e2e/retrieval-service-schema.ts';

const SNAPSHOT = 'data/retrieval-service/results.json';
if (fs.existsSync(SNAPSHOT)) parseSnapshot(fs.readFileSync(SNAPSHOT, 'utf8'));

const PAGE = 'retrieval-service.html';
const HELD = '<section id="demo" hidden>';
const page = fs.readFileSync(PAGE, 'utf8');
if (page.split(HELD).length !== 2) throw new Error(`${PAGE} must hold ${HELD} exactly once`);
if ((process.env.RETRIEVAL_DEMO || '').trim().toLowerCase() === 'on') {
  fs.writeFileSync(PAGE, page.replace(HELD, '<section id="demo">'));
}
