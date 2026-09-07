import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Candidate paths to locate .env across monorepo root, package local, or cwd
const candidatePaths = [
  path.resolve(__dirname, '../../../.env'), // Monorepo root from apps/api/src or apps/api/dist
  path.resolve(__dirname, '../.env'),       // apps/api/.env from apps/api/src or apps/api/dist
  path.resolve(process.cwd(), '../../.env'), // If cwd is deep inside workspace
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '.env'),      // If cwd is LinearCard root
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
