// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { Recordlane } from '../src/index.js';

describe('Recordlane client', () => {
  it('adds credentials and exposes capabilities', async () => {
    let authorization = '';
    const fakeFetch: typeof fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return new Response(JSON.stringify({product:'Recordlane',version:'0.1.0-alpha.1',api_version:'v1',authentication:[],features:[]}), {status:200, headers:{'content-type':'application/json'}});
    };
    const client = new Recordlane('https://recordlane.invalid', {credentialHook:()=> 'test-token', fetch:fakeFetch});
    expect((await client.capabilities()).api_version).toBe('v1');
    expect(authorization).toBe('Bearer test-token');
  });
  it('does not retry an unprotected write', async () => {
    let calls=0; const failing: typeof fetch = async()=>{calls++; throw new TypeError('offline')};
    const client=new Recordlane('https://recordlane.invalid',{fetch:failing,retries:3});
    await expect(client.request('POST','/domains',{body:{}})).rejects.toThrow('offline');
    expect(calls).toBe(1);
  });
});
