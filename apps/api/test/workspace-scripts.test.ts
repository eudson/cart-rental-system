import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

interface PackageManifest {
  scripts?: Record<string, string>;
}

async function readPackageManifest(relativePath: string): Promise<PackageManifest> {
  const filePath = path.resolve(__dirname, '..', '..', '..', '..', relativePath);
  const contents = await readFile(filePath, 'utf8');

  return JSON.parse(contents) as PackageManifest;
}

test('workspace manifests expose the root and package scripts needed for Phase 1 development', async () => {
  const rootManifest = await readPackageManifest('package.json');
  const apiManifest = await readPackageManifest('apps/api/package.json');
  const webManifest = await readPackageManifest('apps/web/package.json');

  assert.deepEqual(rootManifest.scripts, {
    'db:migrate': 'pnpm --filter api prisma:migrate',
    'db:seed': 'pnpm --filter api prisma:seed',
    'db:studio': 'pnpm --filter api prisma:studio',
    'dev:api': 'pnpm --filter api start',
    'dev:web': 'pnpm --filter web dev',
  });

  assert.equal(
    apiManifest.scripts?.['prisma:migrate'],
    'set -a && . ../../.env && set +a && prisma migrate dev --schema prisma/schema.prisma',
  );
  assert.equal(
    apiManifest.scripts?.['prisma:studio'],
    'set -a && . ../../.env && set +a && prisma studio --schema prisma/schema.prisma',
  );
  assert.equal(apiManifest.scripts?.start, 'set -a && . ../../.env && set +a && node dist/src/main.js');
  assert.ok(webManifest.scripts?.dev, 'web dev script must be defined');
});
