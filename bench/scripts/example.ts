// SPDX-License-Identifier: Apache-2.0
/** Prints the example file in docs/examples/branch-office.lwise (DOC-03): `node --experimental-transform-types bench/scripts/example.ts > docs/examples/branch-office.lwise`. */
import {
  addDevice,
  assignIp,
  connect,
  createDocument,
  serializeDocument,
  sequentialIds,
  setClock,
  setIdSource,
  updateInterface,
  upsertSubnet,
  upsertVlan,
  type Command,
} from '@linewise/core';

setIdSource(sequentialIds('ex-'));
setClock(() => '2026-01-01T00:00:00.000Z');
const doc = createDocument('Branch office');
const run = (c: Command) => c.run(doc);
const pageId = doc.pages[0]!.id;
const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, hostname: 'R1' });
const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 200 }, hostname: 'SW1' });
run(r);
run(s);
const vlan = upsertVlan({ number: 10, name: 'Users' });
run(vlan);
run(upsertSubnet({ cidr: '10.0.10.0/24', name: 'Users', vlanId: vlan.vlanId, gatewayIp: '10.0.10.1' }));
const c = connect({ deviceId: r.deviceId }, { deviceId: s.deviceId });
run(c);
const l = doc.links[0]!;
run(updateInterface(l.endpointA.deviceId, l.endpointA.interfaceId, { mode: 'routed' }));
run(assignIp(l.endpointA.deviceId, l.endpointA.interfaceId, '10.0.10.1', 24));
run(updateInterface(l.endpointB.deviceId, l.endpointB.interfaceId, { mode: 'access', accessVlan: 10 }));
process.stdout.write(serializeDocument(doc));
