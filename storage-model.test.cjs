const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('js/toolkit-data.js', 'utf8').replace(/^export /gm, '');
const context = { console, Blob: global.Blob, JSON };
vm.createContext(context);
vm.runInContext(`${source}\nthis.api={isPlainObject,parseStoredToolkitData,validateToolkitData,unwrapBackup,mergeToolkitCollections,findDuplicateInventory,safeStorageWrite,restoreWithRollback,findDuplicateCase,upsertToolkitItem,mergeNetworkInventory,upsertTroubleshootingCase,removeToolkitItem,filterToolkitCases,createBackupEnvelope,previewBackupText,buildDailyReport};`, context);
const api = context.api;

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    snapshot() { return Object.fromEntries(data); }
  };
}

test('migration accepts legacy object and preserves unknown fields', () => {
  const parsed = api.parseStoredToolkitData(JSON.stringify({ records: [], inventory: [], form: { old: true }, customField: 'keep' }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.customField, 'keep');
});

test('corrupt JSON and non-object roots are rejected without replacement', () => {
  for (const raw of ['{broken', '[]', 'null', '42', '"text"']) {
    const parsed = api.parseStoredToolkitData(raw);
    assert.equal(parsed.ok, false);
  }
});

for (const raw of ['{}', '{"records":[]}']) {
  test(`valid toolkit root ${raw}`, () => assert.equal(api.parseStoredToolkitData(raw).ok, true));
}

test('records and inventory with invalid types are rejected', () => {
  assert.equal(api.parseStoredToolkitData('{"records":{}}').ok, false);
  assert.equal(api.parseStoredToolkitData('{"inventory":"x"').ok, false);
});

test('merge preserves old and new collections and unknown fields', () => {
  const oldData = { records: [{ caseNumber: 'A' }], inventory: [{ computerName: 'PC1' }], legacy: 1 };
  const incoming = { records: [{ caseNumber: 'A', status: 'Resolved' }, { caseNumber: 'B' }], inventory: [{ computerName: 'PC1', ipAddress: '10.0.0.1' }], custom: 2 };
  const merged = api.mergeToolkitCollections(oldData, incoming);
  assert.equal(merged.records.length, 2);
  assert.equal(merged.records.find(r => r.caseNumber === 'A').status, 'Resolved');
  assert.equal(merged.inventory[0].ipAddress, '10.0.0.1');
  assert.equal(merged.legacy, 1);
  assert.equal(merged.custom, 2);
});

test('network troubleshooting case can be created and updated without duplicates', () => {
  const source = { id: 'guide-1', caseNumber: '', symptomDetail: 'เชื่อมต่อไม่ได้ — พบหลายเครื่อง', investigation: 'ตรวจ Gateway: พบปัญหา', resolution: 'ตรวจสายและ Wi-Fi', troubleshooting: { stages: { gateway: 'issue' } } };
  const created = api.upsertTroubleshootingCase([], source);
  assert.equal(created.items.length, 1);
  const updated = api.upsertTroubleshootingCase(created.items, { ...source, investigation: 'ตรวจ Gateway: พบปัญหา\nตรวจ DNS: ผ่าน' });
  assert.equal(updated.items.length, 1);
  assert.equal(updated.updated, true);
  assert.match(updated.item.investigation, /DNS/);
});

test('network information maps fields into inventory and updates duplicate safely', () => {
  const created = api.mergeNetworkInventory([], { computerName: 'TEST-PC', ipAddress: '10.0.0.10', gateway: '10.0.0.1', dnsServer: '8.8.8.8' }, '', () => 'pc-1');
  assert.equal(created.items[0].computerName, 'TEST-PC');
  assert.equal(created.items[0].gateway, '10.0.0.1');
  const updated = api.mergeNetworkInventory(created.items, { computerName: 'test-pc', ipAddress: '10.0.0.11', subnetMask: '255.255.255.0' });
  assert.equal(updated.items.length, 1);
  assert.equal(updated.updated, true);
  assert.equal(updated.item.gateway, '10.0.0.1');
  assert.equal(updated.item.subnetMask, '255.255.255.0');
});

test('inventory duplicate handles missing computerName and supports IP/name duplicate', () => {
  const existing = [{ id: '1' }, { id: '2', computerName: '  PC-A  ', ipAddress: '' }, { id: '3', ipAddress: '10.1.1.5' }];
  assert.equal(api.findDuplicateInventory(existing, { computerName: 'pc-a', ipAddress: '' })?.id, '2');
  assert.equal(api.findDuplicateInventory(existing, { ipAddress: '10.1.1.5' })?.id, '3');
  assert.equal(api.findDuplicateInventory(existing, { computerName: '', ipAddress: '' }), null);
});

test('backup envelope unwrap and validation preserve unknown fields', () => {
  const envelope = { format: 'network-toolkit-backup', data: { records: [], inventory: [], custom: { keep: true } } };
  const data = api.unwrapBackup(envelope);
  assert.equal(api.validateToolkitData(data), true);
  assert.equal(data.custom.keep, true);
});

for (const value of [null, [], 42, 'x']) {
  test(`backup rejects non-object root ${JSON.stringify(value)}`, () => assert.equal(api.validateToolkitData(value), false));
}

test('backup storage write failure returns false and leaves memory unchanged', () => {
  const failed = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  assert.equal(api.safeStorageWrite(failed, 'networkToolkitData', { records: [] }), false);
});

test('restore writes and verifies valid backup', () => {
  const store = storage({ networkToolkitData: '{"records":[{"caseNumber":"OLD"}],"inventory":[]}' });
  const result = api.restoreWithRollback(store, 'networkToolkitData', { format: 'network-toolkit-backup', data: { records: [{ caseNumber: 'NEW' }], inventory: [], custom: true } });
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(store.getItem('networkToolkitData')).records[0].caseNumber, 'NEW');
});

test('restore rejects invalid structure and preserves current value', () => {
  const original = '{"records":[],"inventory":[]}';
  const store = storage({ networkToolkitData: original });
  const result = api.restoreWithRollback(store, 'networkToolkitData', { records: {} });
  assert.equal(result.ok, false);
  assert.equal(store.getItem('networkToolkitData'), original);
});

test('restore storage failure rolls back primary data and state file', () => {
  const original = '{"records":[{"caseNumber":"OLD"}],"inventory":[]}';
  const data = new Map([['networkToolkitData', original]]);
  const store = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { if (String(value).includes('NEW')) throw new Error('quota'); data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
  const result = api.restoreWithRollback(store, 'networkToolkitData', { records: [{ caseNumber: 'NEW' }], inventory: [] });
  assert.equal(result.ok, false);
  assert.equal(store.getItem('networkToolkitData'), original);
});

test('case and inventory item CRUD uses isolated test arrays', () => {
  const created = api.upsertToolkitItem([], { caseNumber: 'IT-TEST-001', symptomDetail: 'Test case' }, '', () => 'case-test-1');
  assert.equal(created.ok, true);
  assert.equal(created.items.length, 1);
  const updated = api.upsertToolkitItem(created.items, { status: 'Resolved' }, 'case-test-1');
  assert.equal(updated.item.status, 'Resolved');
  const removed = api.removeToolkitItem(updated.items, 'case-test-1');
  assert.equal(removed.ok, true);
  assert.deepEqual(Array.from(removed.items), []);
  const inventory = api.upsertToolkitItem([], { computerName: 'TEST-PC', ipAddress: '192.0.2.10' }, '', () => 'pc-test-1').items;
  assert.equal(api.findDuplicateInventory(inventory, { computerName: 'test-pc', ipAddress: '' })?.id, 'pc-test-1');
});

test('case duplicate detection and filters work without browser storage', () => {
  const records = [
    { id: '1', caseNumber: 'IT-TEST-001', type: 'Network', status: 'Open', createdAt: '2026-10-28T09:00:00', symptomDetail: 'WAN down' },
    { id: '2', caseNumber: 'IT-TEST-002', type: 'Printer', status: 'Waiting', createdAt: '2026-10-27T09:00:00', symptomDetail: 'Offline' }
  ];
  assert.equal(api.findDuplicateCase(records, { caseNumber: 'it-test-001' })?.id, '1');
  assert.equal(api.findDuplicateCase(records, { caseNumber: 'IT-TEST-003' }), null);
  assert.equal(api.filterToolkitCases(records, { type: 'Printer', status: 'Waiting' }).length, 1);
  assert.equal(api.filterToolkitCases(records, { date: '2026-10-28' })[0].id, '1');
});

test('daily report uses only supplied records and empty sections are explicit', () => {
  const today = new Date(2026, 9, 28, 12, 0, 0);
  const report = api.buildDailyReport([
    { caseNumber: 'IT-TEST-001', createdAt: '2026-10-28T08:00:00', status: 'Waiting', symptomDetail: 'Printer offline', notes: 'Call user' },
    { caseNumber: 'IT-OLD-001', createdAt: '2026-10-27T08:00:00', status: 'Resolved', symptomDetail: 'Old case' }
  ], today);
  assert.match(report, /IT-TEST-001/);
  assert.doesNotMatch(report, /IT-OLD-001/);
  assert.match(report, /เคสที่แก้ไขแล้ว \(0 เคส\)/);
  assert.match(report, /เคสที่รอผู้ใช้หรืออุปกรณ์ \(1 เคส\)/);
});

test('backup preview export envelope and invalid import handling', () => {
  const data = { records: [{ caseNumber: 'IT-TEST-001' }], inventory: [], unknown: { keep: true } };
  const envelope = api.createBackupEnvelope(data);
  assert.equal(envelope.format, 'network-toolkit-backup');
  const preview = api.previewBackupText(JSON.stringify(envelope));
  assert.equal(preview.ok, true);
  assert.equal(preview.records, 1);
  assert.equal(preview.data.unknown.keep, true);
  assert.equal(api.previewBackupText('{broken').ok, false);
  assert.equal(api.previewBackupText('{"records":{},"inventory":[]}').ok, false);
});
