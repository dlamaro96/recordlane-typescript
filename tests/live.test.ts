// SPDX-License-Identifier: Apache-2.0
import { expect, it } from 'vitest';
import { ForbiddenError, Recordlane } from '../src/index.js';

const base = process.env.RECORDLANE_BASE_URL ?? 'http://127.0.0.1:8088';
it('queries and enforces permissions on the running release', async () => {
  const client = new Recordlane(base,{demoUser:'typescript-sdk',demoRoles:'read_only'});
  expect((await client.capabilities()).api_version).toBe('v1');
  expect((await client.capabilities()).version).toBe('0.1.0-alpha.2');
  expect((await client.domains()).length).toBeGreaterThanOrEqual(3);
  expect((await client.entities()).length).toBeGreaterThan(0);
  await expect(client.relayPublication('typescript-sdk-forbidden')).rejects.toBeInstanceOf(ForbiddenError);
});
