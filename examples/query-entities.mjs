import { Recordlane } from '../dist/index.js';
const client = new Recordlane('http://127.0.0.1:8088', {demoUser:'example', demoRoles:'read_only'});
for await (const entity of client.paginate('/entities')) console.log(entity.stable_key, entity.approval_state);
