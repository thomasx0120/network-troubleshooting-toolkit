import { findDuplicateInventory, parseStoredToolkitData, unwrapBackup, validateToolkitData, buildDailyReport, createBackupEnvelope } from "./toolkit-data.js";

const STORAGE_KEY = "networkToolkitData";
const esc = value => String(value ?? "").replace(/[&<>''"\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const pad = value => String(value).padStart(2, "0");
const dateKey = value => { const d = value ? new Date(value) : new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const localDateTime = value => { const d = value ? new Date(value) : new Date(); return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const formatDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(d); };
const $ = id => document.querySelector(`#${id}`);
let storageRecoveryRequired = false;

function backupRecoverableData(raw) {
  if (!raw) return;
  const key = `${STORAGE_KEY}.recoverable-backup`;
  try {
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
  } catch {}
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = parseStoredToolkitData(raw);
    if (parsed.ok) return parsed.value;
    storageRecoveryRequired = true;
    backupRecoverableData(raw);
  } catch {}
  return {};
}

let store = readStore();
store.records = Array.isArray(store.records) ? store.records : [];
store.inventory = Array.isArray(store.inventory) ? store.inventory : [];
const saveStore = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return localStorage.getItem(STORAGE_KEY) === JSON.stringify(store); } catch { return false; } };

function normalizeCases() {
  store.records = store.records.map((record, index) => ({
    ...record,
    id: record.id || record.caseNumber || `case-${index}-${Date.now()}`,
    caseNumber: record.caseNumber || `IT-${dateKey(record.createdAt || new Date()).replaceAll("-", "")}-${pad(index + 1)}`,
    status: record.status || "Open",
    type: record.type || "Network",
    createdAt: record.createdAt || new Date().toISOString()
  }));
  store.inventory = store.inventory.map((item, index) => ({ ...item, id: item.id || `inventory-${index}-${Date.now()}` }));
}
normalizeCases();

function feedback(element, message, error = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", error);
}
function openDialog(id) { document.querySelector(`#${id}`)?.showModal(); }
function closeDialog(id) { document.querySelector(`#${id}`)?.close(); }
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.closeDialog)));

function nextCaseNumber() {
  const prefix = `IT-${dateKey().replaceAll("-", "")}-`;
  const used = store.records.map(record => record.caseNumber).filter(value => typeof value === "string" && value.startsWith(prefix)).map(value => Number(value.slice(prefix.length))).filter(Number.isFinite);
  return `${prefix}${pad(Math.max(0, ...used) + 1)}`;
}

function renderDashboard() {
  const statuses = ["Open", "In Progress", "Waiting", "Resolved"];
  const labels = { Open: "งานเปิดใหม่", "In Progress": "กำลังดำเนินการ", Waiting: "รอการดำเนินการ", Resolved: "แก้ไขแล้ว" };
  const cards = statuses.map(status => [labels[status], store.records.filter(record => (record.status || "Open") === status).length]);
  cards.push(["งานวันนี้", store.records.filter(record => dateKey(record.createdAt) === dateKey()).length]);
  cards.push(["งานติดตาม", store.records.filter(record => record.status !== "Resolved" && record.notes?.trim()).length]);
  $("support-dashboard-stats").innerHTML = cards.map(([label, count]) => `<article class="stat-card"><strong>${count}</strong><span>${esc(label)}</span></article>`).join("");
}

function filteredCases() {
  const query = $("case-search").value.trim().toLocaleLowerCase("th");
  const type = $("case-filter-type").value;
  const status = $("case-filter-status").value;
  const date = $("case-filter-date").value;
  return store.records.filter(record => (!type || record.type === type) && (!status || record.status === status) && (!date || dateKey(record.createdAt) === date)).filter(record => !query || [record.caseNumber, record.computerName, record.ipAddress, record.symptomDetail, record.reporter, record.branch, record.department].join(" ").toLocaleLowerCase("th").includes(query)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderCases() {
  const rows = filteredCases();
  $("case-empty").hidden = rows.length > 0;
  $("case-table-body").innerHTML = rows.map(record => `<tr><td><strong>${esc(record.caseNumber)}</strong></td><td><strong>${esc(record.symptomDetail || "-")}</strong><small>${esc(record.branch || "")}${record.department ? ` · ${esc(record.department)}` : ""}</small></td><td>${esc(record.computerName || "-")}<small>${esc(record.ipAddress || "")}</small></td><td>${esc(record.status || "Open")}</td><td>${esc(formatDate(record.createdAt))}</td><td><div class="row-actions"><button class="text-button" type="button" data-case-action="open" data-id="${esc(record.id)}">เปิดแก้</button><button class="text-button" type="button" data-case-action="report" data-id="${esc(record.id)}">รายงาน</button><button class="text-button danger-text" type="button" data-case-action="delete" data-id="${esc(record.id)}">ลบ</button></div></td></tr>`).join("");
  renderDashboard();
}

const caseForm = $("case-form");
function resetCaseForm() {
  caseForm.reset();
  caseForm.elements.id.value = "";
  caseForm.elements.caseNumber.value = nextCaseNumber();
  caseForm.elements.createdAt.value = localDateTime();
  caseForm.elements.status.value = "Open";
  caseForm.elements.type.value = "Network";
  $("case-form-heading").textContent = "สร้างเคสใหม่";
}
$("new-case-button").addEventListener("click", () => { resetCaseForm(); openDialog("case-dialog"); });
function findCase(id) { return store.records.find(record => String(record.id || record.caseNumber) === String(id)); }
caseForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(caseForm).entries());
  if (!data.symptomDetail?.trim()) { feedback($("case-form-feedback"), "กรุณากรอกอาการและผลกระทบ", true); return; }
  const record = findCase(data.id);
  const previous = record ? { ...record } : null;
  if (record) Object.assign(record, data, { updatedAt: new Date().toISOString() });
  else store.records.push({ id: crypto.randomUUID?.() || `case-${Date.now()}`, ...data, createdAt: data.createdAt || new Date().toISOString() });
  if (!saveStore()) {
    if (record) Object.assign(record, previous);
    else store.records.pop();
    feedback($("case-form-feedback"), "บันทึกไม่สำเร็จ ข้อมูลเดิมยังคงอยู่", true);
    return;
  }
  closeDialog("case-dialog");
  renderCases();
});
$("case-table-body").addEventListener("click", event => {
  const button = event.target.closest("[data-case-action]"); if (!button) return;
  const record = findCase(button.dataset.id); if (!record) return;
  if (button.dataset.caseAction === "delete") {
    if (!confirm(`ยืนยันลบเคส ${record.caseNumber}?`)) return;
    const index = store.records.indexOf(record); store.records.splice(index, 1);
    if (!saveStore()) { store.records.splice(index, 0, record); feedback($("archive-feedback"), "ลบเคสไม่สำเร็จ ข้อมูลเดิมยังคงอยู่", true); return; }
    renderCases(); return;
  }
  if (button.dataset.caseAction === "report") { copyReport(record); return; }
  for (const control of caseForm.elements) if (control.name) control.value = record[control.name] ?? "";
  caseForm.elements.id.value = record.id;
  caseForm.elements.createdAt.value = localDateTime(record.createdAt);
  $("case-form-heading").textContent = `แก้ไขเคส ${record.caseNumber}`;
  openDialog("case-dialog");
});
["case-search", "case-filter-type", "case-filter-status", "case-filter-date"].forEach(id => $(id).addEventListener(id === "case-search" ? "input" : "change", renderCases));
function caseReport(record) { return [`รายงานเคส ${record.caseNumber || "-"}`, `อาการ: ${record.symptomDetail || "-"}`, `สถานะ: ${record.status || "-"}`, `สาขา: ${record.branch || "-"}`, `แผนก: ${record.department || "-"}`, `อุปกรณ์: ${record.computerName || "-"} (${record.ipAddress || "-"})`, `การตรวจสอบ: ${record.investigation || "-"}`, `สาเหตุที่ยืนยัน: ${record.confirmedCause || "-"}`, `วิธีแก้ไข: ${record.resolution || "-"}`, `ผลทดสอบ: ${record.postTest || "-"}`, `หมายเหตุ: ${record.notes || "-"}`].join("\n"); }
async function copyReport(record) { try { await navigator.clipboard.writeText(caseReport(record)); feedback($("archive-feedback"), "คัดลอกรายงานเคสแล้ว"); } catch { feedback($("archive-feedback"), "คัดลอกไม่สำเร็จ กรุณาเลือกข้อความด้วยตนเอง", true); } }

const inventoryForm = $("inventory-form");
function renderInventory() {
  const query = $("inventory-search").value.trim().toLocaleLowerCase("th");
  const rows = store.inventory.filter(record => !query || [record.computerName, record.userName, record.department, record.branch, record.ipAddress].join(" ").toLocaleLowerCase("th").includes(query));
  $("inventory-empty").hidden = rows.length > 0;
  $("inventory-table-body").innerHTML = rows.map(record => `<tr><td><strong>${esc(record.computerName || "-")}</strong><small>${esc(record.ipAddress || "")}</small></td><td>${esc(record.userName || "-")}<small>${esc(record.department || "-")} · ${esc(record.branch || "-")}</small></td><td>${esc(record.ipAddress || "-")}<small>${esc(record.gateway || "")}</small></td><td>${esc(record.windowsVersion || "ยังไม่ระบุ")}</td><td>${esc(record.lastChecked || "-")}</td><td><button class="text-button" type="button" data-inventory-action="open" data-id="${esc(record.id)}">เปิดแก้</button> <button class="text-button danger-text" type="button" data-inventory-action="delete" data-id="${esc(record.id)}">ลบ</button></td></tr>`).join("");
  $("inventory-computer-names").innerHTML = store.inventory.map(record => `<option value="${esc(record.computerName)}"></option>`).join("");
}
$("new-inventory-button").addEventListener("click", () => { inventoryForm.reset(); inventoryForm.elements.id.value = ""; $("inventory-form-heading").textContent = "เพิ่มเครื่อง"; openDialog("inventory-dialog"); });
function findInventory(id) { return store.inventory.find(record => String(record.id) === String(id)); }
inventoryForm.addEventListener("submit", event => {
  event.preventEventDefault?.();
  event.preventDefault();
  const data = Object.fromEntries(new FormData(inventoryForm).entries());
  if (!data.computerName?.trim()) { feedback($("inventory-form-feedback"), "กรุณากรอกชื่อเครื่อง", true); return; }
  const duplicate = findDuplicateInventory(store.inventory, data, data.id);
  if (duplicate) { feedback($("inventory-form-feedback"), `ซ้ำกับทะเบียน ${duplicate.computerName || "-"}${duplicate.ipAddress ? ` / ${duplicate.ipAddress}` : ""}`, true); return; }
  const item = findInventory(data.id);
  const previous = item ? { ...item } : null;
  if (item) Object.assign(item, data);
  else store.inventory.push({ id: crypto.randomUUID?.() || `pc-${Date.now()}`, ...data });
  if (!saveStore()) { if (item) Object.assign(item, previous); else store.inventory.pop(); feedback($("inventory-form-feedback"), "บันทึกทะเบียนไม่สำเร็จ ข้อมูลเดิมยังคงอยู่", true); return; }
  closeDialog("inventory-dialog"); renderInventory();
});
$("inventory-table-body").addEventListener("click", event => {
  const button = event.target.closest("[data-inventory-action]"); if (!button) return;
  const item = findInventory(button.dataset.id); if (!item) return;
  if (button.dataset.inventoryAction === "delete") { if (!confirm(`ยืนยันลบทะเบียน ${item.computerName}?`)) return; const index = store.inventory.indexOf(item); store.inventory.splice(index, 1); if (!saveStore()) { store.inventory.splice(index, 0, item); feedback($("inventory-feedback"), "ลบทะเบียนไม่สำเร็จ ข้อมูลเดิมยังคงอยู่", true); return; } renderInventory(); return; }
  for (const control of inventoryForm.elements) if (control.name) control.value = item[control.name] ?? "";
  inventoryForm.elements.id.value = item.id;
  $("inventory-form-heading").textContent = `แก้ไขเครื่อง ${item.computerName}`;
  openDialog("inventory-dialog");
});
$("inventory-search").addEventListener("input", renderInventory);
$("export-inventory-json")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ format: "personal-it-inventory", version: 1, inventory: store.inventory }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pc-inventory.json"; link.click(); URL.revokeObjectURL(url);
});
$("export-inventory-csv")?.addEventListener("click", () => {
  const fields = ["computerName", "userName", "department", "branch", "ipAddress", "gateway", "subnetMask", "windowsVersion", "licenseStatus", "lastChecked"];
  const csv = [fields.join(","), ...store.inventory.map(item => fields.map(field => `"${String(item[field] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pc-inventory.csv"; link.click(); URL.revokeObjectURL(url);
});
$("import-inventory-button")?.addEventListener("click", () => $("import-inventory-file")?.click());
$("import-inventory-file")?.addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file) return;
  try { const parsed = JSON.parse(await file.text()); const incoming = Array.isArray(parsed) ? parsed : parsed.inventory; if (!Array.isArray(incoming)) throw new Error("invalid inventory"); if (!confirm("นำเข้า Inventory และเพิ่มรายการที่ไม่ซ้ำหรือไม่? กดตกลงเพื่อรวมข้อมูล")) return; const previous = store.inventory; const merged = [...previous]; incoming.forEach(item => { if (!findDuplicateInventory(merged, item)) merged.push({ id: crypto.randomUUID?.() || `pc-${Date.now()}-${merged.length}`, ...item }); }); store.inventory = merged; if (!saveStore()) { store.inventory = previous; throw new Error("storage write failed"); } renderInventory(); feedback($("inventory-feedback"), "นำเข้า Inventory สำเร็จ"); } catch { feedback($("inventory-feedback"), "ไฟล์ Inventory ไม่ถูกต้องหรือบันทึกไม่สำเร็จ", true); }
});

const printerGuides = {
  "ping-fail": ["ตรวจสาย LAN หรือ Wi-Fi และไฟสถานะ", "1) ping IP เครื่องพิมพ์\n2) ตรวจ IP และ Gateway", "Ping ไม่ผ่าน = ตรวจเครือข่ายหรือ IP", "หยุดและส่งต่อเมื่อ Hardware ชำรุดหรือ IP ผิดนโยบาย"],
  "ping-print-fail": ["ตรวจ Print Queue และ Printer Port", "1) ลองพิมพ์ Test Page\n2) ตรวจ Port และ Queue", "Packet ผ่านแต่พิมพ์ไม่ได้ = อาการอยู่บนเครื่องพิมพ์หรือ Windows", "ส่งต่อเมื่อพบงานค้างหรือสิทธิ์ไม่เพียงพอ"],
  "offline": ["ตรวจ Power และสถานะเครือข่าย", "1) เปิดเครื่องพิมพ์\n2) ตรวจ Spooler และ Connection", "Offline = ตรวจการเชื่อมต่อหรือ IP", "ส่งต่อเมื่อตรวจเครือข่ายแล้วยัง Offline"],
  "queue": ["ตรวจ Print Spooler", "net stop spooler\nnet start spooler", "งานค้างส่วนมากเกิดจาก Driver หรือไฟล์งานเสีย", "คำสั่งเป็นคำสั่งเปลี่ยนระบบ ต้องยืนยันก่อนผู้ดูแล"],
  "driver-port": ["ตรวจ Device Manager, Driver และ Printer Port", "1) เปิด Printer Properties\n2) ตรวจ Port และ Driver", "Driver/Port ผิด = เปลี่ยนเป็นค่าที่ถูกต้อง", "ส่งต่อเมื่อไม่มีสิทธิ์ติดตั้ง Driver"],
  "lan-share": ["ตรวจ Share และ Permission", "1) เปิด IP หรือ Host\\Printer\n2) ตรวจ Firewall และ Share", "ไม่พบ Share = Permission หรือ Network Discovery", "ส่งต่อเมื่อต้องแก้ Group Policy"],
  "scan-fail": ["ตรวจ TWAIN/WIA และ Scanner Software", "1) ทดสอบ Scan ผ่านเครื่อง\n2) ตรวจโปรแกรมสแกน", "สแกนผ่านเครื่องแต่ไม่ผ่าน PC = Driver หรือ Software", "ส่งต่อเมื่อต้องแก้ Firmware"],
  "usb-network": ["ตรวจชนิดการเชื่อมต่อ", "USB: Device Manager\nNetwork: ping IP", "USB ขึ้นผิดพอร์ตหรือ Network Ping ไม่ผ่าน", "ส่งต่อเมื่อพบปัญหา Hardware"]
};
function renderPrinter() {
  const guide = printerGuides[$("printer-symptom").value];
  if (!guide) { $("printer-guide").innerHTML = "<p>ยังไม่มีข้อมูล</p>"; return; }
  $("printer-guide").innerHTML = `<div class="printer-grid"><section><h3>สิ่งที่ต้องตรวจ</h3><p>${esc(guide[0])}</p></section><section><h3>วิธีตรวจ</h3><p class="preline">${esc(guide[1])}</p></section><section><h3>ผลที่อาจพบ</h3><p>${esc(guide[2])}</p></section><section><h3>จุดหยุดและส่งต่อ</h3><p>${esc(guide[3])}</p></section></div>`;
}
$("printer-symptom").addEventListener("change", renderPrinter);

function generateDailyReport() { $("daily-report-text").value = `${buildDailyReport(store.records, new Date())}\n\nเรียน ผู้บริหาร หัวหน้างาน ด้วยความเคารพ ขอรายงานตามข้อมูลข้างต้น`; }
$("generate-report").addEventListener("click", () => { generateDailyReport(); feedback($("report-feedback"), "สร้างรายงานจากเคสที่บันทึกจริงเรียบร้อยแล้ว"); });
$("daily-report-open").addEventListener("click", () => $("daily-report")?.scrollIntoView());
$("copy-daily-report").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("daily-report-text").value); feedback($("report-feedback"), "คัดลอกรายงานแล้ว"); } catch { feedback($("report-feedback"), "คัดลอกอัตโนมัติไม่สำเร็จ", true); } });

function backupSummary(data) { return `${Array.isArray(data.records) ? data.records.length : 0} เคส · ${Array.isArray(data.inventory) ? data.inventory.length : 0} เครื่อง`; }
function uniqueBackupKey() { let key; let index = 0; do { key = `${STORAGE_KEY}.backup-${new Date().toISOString().replaceAll(":", "-")}${index ? `-${index}` : ""}`; index += 1; } while (localStorage.getItem(key) !== null); return key; }
function writeBackup(data) { const raw = typeof data === "string" ? data : JSON.stringify(data); const key = uniqueBackupKey(); localStorage.setItem(key, raw); if (localStorage.getItem(key) !== raw) throw new Error("ตรวจสอบ Backup ไม่สำเร็จ"); return key; }
function backupEntries() {
  const entries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || (!key.startsWith(`${STORAGE_KEY}.backup-`) && !key.startsWith(`${STORAGE_KEY}.recoverable-backup`))) continue;
    try { const raw = localStorage.getItem(key); const parsed = JSON.parse(raw); const data = unwrapBackup(parsed); if (!validateToolkitData(data)) continue; entries.push({ key, raw, data, size: new Blob([raw]).size }); } catch {}
  }
  return entries.sort((a, b) => b.key.localeCompare(a.key));
}
let selectedBackupKey = "";
function renderBackups() {
  const entries = backupEntries(); $("backup-empty").hidden = entries.length > 0;
  $("backup-table-body").innerHTML = entries.map(entry => `<tr><td>${esc(entry.key.replace(`${STORAGE_KEY}.`, ""))}</td><td>${esc(entry.size)} bytes</td><td>${esc(backupSummary(entry.data))}</td><td><button class="text-button" type="button" data-backup-action="export" data-key="${esc(entry.key)}">Export</button> <button class="text-button" type="button" data-backup-action="restore" data-key="${esc(entry.key)}">กู้คืน</button></td></tr>`).join("");
  $("export-backup-button").disabled = !entries.length;
}
function restoreBackup(raw, label) {
  let parsed; try { parsed = JSON.parse(raw); } catch { feedback($("backup-feedback"), "ไฟล์ Backup ไม่ใช่ JSON ที่ถูกต้อง ข้อมูลปัจจุบันยังไม่ถูกเปลี่ยน", true); return false; }
  const restored = unwrapBackup(parsed);
  if (!validateToolkitData(restored)) { feedback($("backup-feedback"), "โครงสร้าง Backup ไม่รองรับ ข้อมูลปัจจุบันยังไม่ถูกเปลี่ยน", true); return false; }
  if (!confirm(`กู้คืนจาก “${label}”?
ระบบจะสำรองข้อมูลปัจจุบันก่อนการกู้คืน`)) return false;
  try { const currentRaw = localStorage.getItem(STORAGE_KEY); const currentSnapshot = currentRaw ? JSON.parse(currentRaw) : {}; writeBackup(createBackupEnvelope(validateToolkitData(currentSnapshot) ? currentSnapshot : { _recoverableRaw: currentRaw })); }
  catch { feedback($("backup-feedback"), "ไม่สามารถสำรองข้อมูลปัจจุบันได้ จึงยังไม่กู้คืน", true); return false; }
  const previousRaw = localStorage.getItem(STORAGE_KEY); const serialized = JSON.stringify(restored);
  try { localStorage.setItem(STORAGE_KEY, serialized); if (localStorage.getItem(STORAGE_KEY) !== serialized) throw new Error("restore verification failed"); }
  catch { try { previousRaw == null ? localStorage.removeItem(STORAGE_KEY) : localStorage.setItem(STORAGE_KEY, previousRaw); } catch {} feedback($("backup-feedback"), "กู้คืนไม่สำเร็จ ข้อมูลเดิมถูกเก็บไว้", true); return false; }
  store = restored; normalizeCases(); renderCases(); renderInventory(); renderBackups(); feedback($("backup-feedback"), `กู้คืนสำเร็จจาก ${label}`); return true;
}
$("create-backup-button").addEventListener("click", () => { try { const key = writeBackup(createBackupEnvelope(store)); renderBackups(); feedback($("backup-feedback"), `สร้าง Backup เรียบร้อย: ${key}`); } catch { feedback($("backup-feedback"), "ไม่สามารถสร้าง Backup ได้", true); } });
$("backup-table-body").addEventListener("click", event => { const button = event.target.closest("[data-backup-action]"); if (!button) return; selectedBackupKey = button.dataset.key; if (button.dataset.backupAction === "restore") { const entry = backupEntries().find(item => item.key === selectedBackupKey); if (entry) restoreBackup(entry.raw, entry.key); } });
$("export-backup-button").addEventListener("click", () => { const entry = backupEntries().find(item => item.key === selectedBackupKey) || backupEntries()[0]; if (!entry) return; const blob = new Blob([JSON.stringify(createBackupEnvelope(entry.data), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "network-toolkit-backup.json"; link.click(); URL.revokeObjectURL(url); feedback($("backup-feedback"), "ส่งออก Backup เรียบร้อย"); });
$("import-backup-button").addEventListener("click", () => $("import-backup-file").click());
$("import-backup-file").addEventListener("change", async event => { const file = event.target.files[0]; if (!file) return; try { const data = unwrapBackup(JSON.parse(await file.text())); if (!validateToolkitData(data)) throw new Error("invalid structure"); if (!confirm(`พบ ${backupSummary(data)} ต้องการกู้คืนข้อมูลหรือไม่?`)) return; restoreBackup(JSON.stringify(createBackupEnvelope(data)), file.name); } catch { feedback($("backup-feedback"), "ไฟล์ JSON ไม่ถูกต้องหรือโครงสร้างไม่รองรับ ข้อมูลปัจจุบันยังไม่ถูกเปลี่ยน", true); } });

renderCases(); renderInventory(); renderPrinter(); renderBackups();
