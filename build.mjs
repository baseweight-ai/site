// The build Vercel runs (vercel.json buildCommand, which Vercel caps at 256
// characters). A malformed results snapshot fails the deploy.
import * as fs from 'fs';
import { parseSnapshot } from './e2e/retrieval-service-schema.ts';

const SNAPSHOT = 'data/retrieval-service/results.json';
if (fs.existsSync(SNAPSHOT)) parseSnapshot(fs.readFileSync(SNAPSHOT, 'utf8'));
