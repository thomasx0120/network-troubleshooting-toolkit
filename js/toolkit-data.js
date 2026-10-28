export const STORAGE_KEY = "networkToolkitData";

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStoredToolkitData(raw) {
  if (raw == null || raw === "") return { ok: true, value: {}, raw: raw };
  try {
    const value = JSON.parse(raw);
    if (!isPlainObject(value)) return { ok: false, value: null, raw, reason: "root-must-be-object" };
    if (Object.prototype.hasOwnProperty.call(value, "records") && !Array.isArray(value.records)) {
      return { ok: false, value: null, raw, reason: "records-must-be-array" };
    }
    if (Object.prototype.hasOwnProperty.call(value, "inventory") && !Array.isArray(value.inventory)) {
      return { ok: false, value: null, raw, reason: "inventory-must-be-array" };
    }
    return { ok: true, value, raw };
  } catch {
    return { ok: false, value: null, raw, reason: "invalid-json" };
  }
}

export function validateToolkitData(value) {
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "records") && !Array.isArray(value.records)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "inventory") && !Array.isArray(value.inventory)) return false;
  return true;
}

export function unwrapBackup(value) {
  if (isPlainObject(value) && value.format === "network-toolkit-backup" && isPlainObject(value.data)) return value.data;
  return value;
}

export function mergeToolkitCollections(previous, incoming) {
  const first = isPlainObject(previous) ? previous : {};
  const second = isPlainObject(incoming) ? incoming : {};
  const merged = { ...first, ...second };
  merged.records = mergeById(first.records, second.records, "id", "caseNumber");
  merged.inventory = mergeById(first.inventory, second.inventory, "id", "computerName");
  return merged;
}

function mergeById(oldValue, newValue, idField, fallbackField) {
  const oldItems = Array.isArray(oldValue) ? oldValue : [];
  const newItems = Array.isArray(newValue) ? newValue : [];
  const positions = new Map();
  newItems.forEach((item, index) => {
    if (!isPlainObject(item)) return;
    const key = item[idField] ?? item[fallbackField];
    if (key != null) positions.set(String(key).toLocaleLowerCase(), index);
  });
  const output = oldItems.map(item => {
    if (!isPlainObject(item)) return item;
    const key = item[idField] ?? item[fallbackField];
    const index = key == null ? -1 : positions.get(String(key).toLocaleLowerCase());
    if (index == null) return item;
    const incoming = newItems[index];
    positions.delete(String(key).toLocaleLowerCase());
    return { ...item, ...incoming };
  });
  newItems.forEach((item, index) => {
    if (!isPlainObject(item)) return;
    const key = item[idField] ?? item[fallbackField];
    if ((key != null && positions.has(String(key).toLocaleLowerCase())) || key == null) output.push(item);
  });
  return output;
}

export function findDuplicateInventory(existing, candidate, currentId = "") {
  const name = typeof candidate.computerName === "string" ? candidate.computerName.trim().toLocaleLowerCase() : "";
  const ip = typeof candidate.ipAddress === "string" ? candidate.ipAddress.trim() : "";
  return existing.find(item => {
    if (!isPlainObject(item) || String(item.id || "") === String(currentId)) return false;
    const itemName = typeof item.computerName === "string" ? item.computerName.trim().toLocaleLowerCase() : "";
    const itemIp = typeof item.ipAddress === "string" ? item.ipAddress.trim() : "";
    return Boolean(name && itemName && name === itemName) || Boolean(ip && itemIp && ip === itemIp);
  }) || null;
}

export function safeStorageWrite(storage, key, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  try {
    storage.setItem(key, serialized);
    return storage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

export function restoreWithRollback(storage, key, value) {
  let previous = null;
  try {
    previous = storage.getItem(key);
    const parsed = unwrapBackup(value);
    if (!validateToolkitData(parsed)) return { ok: false, reason: "unsupported-data" };
    const serialized = JSON.stringify(parsed);
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new Error("verification failed");
    return { ok: true, value: parsed };
  } catch {
    try {
      if (previous == null) storage.removeItem(key);
      else storage.setItem(key, previous);
    } catch {}
    return { ok: false, reason: "storage-write-failed" };
  }
}

export function findDuplicateCase(existing, candidate, currentId = "") {
  const number = typeof candidate.caseNumber === "string" ? candidate.caseNumber.trim().toLocaleLowerCase() : "";
  return existing.find(item => {
    if (!isPlainObject(item) || String(item.id || "") === String(currentId)) return false;
    const itemNumber = typeof item.caseNumber === "string" ? item.caseNumber.trim().toLocaleLowerCase() : "";
    return Boolean(number && itemNumber && number === itemNumber);
  }) || null;
}

export function upsertToolkitItem(items, candidate, currentId = "", createId = () => "") {
  if (!Array.isArray(items) || !isPlainObject(candidate)) return { ok: false, reason: "invalid-input", items };
  const list = [...items];
  const id = currentId ? String(currentId) : String(candidate.id || "");
  if (id) {
    const index = list.findIndex(item => String(item?.id || item?.caseNumber || "") === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...candidate, id: list[index].id || candidate.id || id };
      return { ok: true, items: list, item: list[index], updated: true };
    }
  }
  const generatedId = candidate.id || createId();
  const item = generatedId ? { ...candidate, id: generatedId } : { ...candidate };
  list.push(item);
  return { ok: true, items: list, item, updated: false };
}

export function mergeNetworkInventory(existing, network, currentId = "", createId = () => "") {
  const list = Array.isArray(existing) ? existing.map(item => ({ ...item })) : [];
  const candidate = isPlainObject(network) ? network : {};
  const duplicate = findDuplicateInventory(list, candidate, currentId);
  const fields = ["computerName", "ipAddress", "subnetMask", "gateway", "dnsServer", "notes"];
  const updates = Object.fromEntries(fields.filter(field => String(candidate[field] ?? "").trim() !== "").map(field => [field, String(candidate[field]).trim()]));
  if (duplicate) {
    const index = list.indexOf(duplicate);
    list[index] = { ...duplicate, ...updates };
    return { ok: true, items: list, item: list[index], updated: true };
  }
  const item = { id: String(createId()), ...updates };
  list.push(item);
  return { ok: true, items: list, item, updated: false };
}

export function upsertTroubleshootingCase(existing, candidate) {
  if (!Array.isArray(existing) || !isPlainObject(candidate)) return { ok: false, reason: "invalid-input", items: existing };
  const list = [...existing];
  const id = String(candidate.id || "");
  const index = id ? list.findIndex(item => String(item?.id || "") === id) : -1;
  if (index >= 0) {
    list[index] = { ...list[index], ...candidate };
    return { ok: true, items: list, item: list[index], updated: true };
  }
  list.push(candidate);
  return { ok: true, items: list, item: candidate, updated: false };
}

export function removeToolkitItem(items, id) {
  if (!Array.isArray(items)) return { ok: false, items, reason: "invalid-input" };
  const target = String(id);
  const index = items.findIndex(item => String(item?.id || item?.caseNumber || "") === target);
  if (index < 0) return { ok: false, items, reason: "not-found" };
  const output = [...items];
  output.splice(index, 1);
  return { ok: true, items: output, removed: items[index] };
}

export function filterToolkitCases(records, filters = {}) {
  const list = Array.isArray(records) ? records : [];
  const query = String(filters.query || "").trim().toLocaleLowerCase();
  const dateKey = value => String(value || "").slice(0, 10);
  return list.filter(record => {
    if (!isPlainObject(record)) return false;
    if (filters.type && record.type !== filters.type) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (filters.date && dateKey(record.createdAt) !== filters.date) return false;
    if (!query) return true;
    return [record.caseNumber, record.computerName, record.ipAddress, record.symptomDetail, record.reporter, record.branch, record.department]
      .some(value => String(value || "").toLocaleLowerCase().includes(query));
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function createBackupEnvelope(data) {
  return { format: "network-toolkit-backup", version: 1, exportedAt: new Date().toISOString(), data };
}

export function previewBackupText(raw) {
  try {
    const parsed = JSON.parse(raw);
    const data = unwrapBackup(parsed);
    if (!validateToolkitData(data)) return { ok: false, reason: "unsupported-data" };
    return { ok: true, data, records: Array.isArray(data.records) ? data.records.length : 0, inventory: Array.isArray(data.inventory) ? data.inventory.length : 0 };
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
}

export function buildDailyReport(records, today = new Date()) {
  const list = Array.isArray(records) ? records : [];
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayCases = list.filter(record => String(record.createdAt || "").slice(0, 10) === todayKey);
  const resolved = todayCases.filter(record => record.status === "Resolved");
  const pending = todayCases.filter(record => record.status !== "Resolved");
  const waiting = todayCases.filter(record => record.status === "Waiting");
  const follow = list.filter(record => record.status !== "Resolved" && String(record.notes || "").trim());
  const lines = items => items.length ? items.map(record => `- ${record.caseNumber || "-"}: ${record.symptomDetail || "ไม่มีรายละเอียด"} (${record.status || "-"})`).join("\n") : "- ไม่มีรายการ";
  return [
    "รายงานงาน IT Support ประจำวัน", "", `งานที่ดำเนินการวันนี้ (${todayCases.length} เคส)`, lines(todayCases), "",
    `เคสที่แก้ไขแล้ว (${resolved.length} เคส)`, lines(resolved), "", `เคสที่ยังค้าง (${pending.length} เคส)`, lines(pending), "",
    `เคสที่รอผู้ใช้หรืออุปกรณ์ (${waiting.length} เคส)`, lines(waiting), "", `ปัญหาที่ต้องติดตาม (${follow.length} เคส)`, lines(follow)
  ].join("\n");
}
