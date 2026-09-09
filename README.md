# Recordlane TypeScript

Typed dependency-free TypeScript client for Recordlane `0.1.x`, supporting credential hooks, cursor streaming, timeouts, typed errors, and retries limited to reads or idempotency-protected writes.

```bash
npm ci
npm test
npm run build
RECORDLANE_BASE_URL=http://127.0.0.1:8088 npm run test:live
node examples/query-entities.mjs
```

Start `./recordlane demo` in the platform repository before the live test.
