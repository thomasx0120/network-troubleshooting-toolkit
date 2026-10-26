const STORAGE_KEY = "networkToolkitData";
let storageReadError = false;

function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function readSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    storageReadError = true;
    return {};
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

let savedData = readSavedData();
const savedState = document.querySelector("#saved-state");
const notesSaveStatus = document.querySelector("#notes-save-status");

if (storageReadError) {
  savedState.textContent = "ไม่สามารถอ่านข้อมูลเดิมได้";
  notesSaveStatus.textContent = "เบราว์เซอร์ปิดการใช้งานพื้นที่จัดเก็บ";
}

function persistCurrentData() {
  const formData = Object.fromEntries(new FormData(networkForm).entries());
  const checklist = Object.fromEntries(checklistItems.map((checkbox) => [checkbox.dataset.check, checkbox.checked]));
  savedData = { ...savedData, form: formData, checklist, quickNotes: notesField.value };

  const didSave = saveData(savedData);
  savedState.textContent = didSave ? "บันทึกในเครื่องนี้" : "บันทึกไม่สำเร็จ";
  notesSaveStatus.textContent = didSave ? "บันทึกอัตโนมัติในเครื่องนี้" : "บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ";
}

async function copyText(text, feedbackElement, successMessage) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    showFeedback(feedbackElement, "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณาเปิดผ่าน HTTPS หรือคัดลอกข้อความด้วยตนเอง", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showFeedback(feedbackElement, successMessage);
  } catch (error) {
    showFeedback(feedbackElement, "คัดลอกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การใช้คลิปบอร์ดของเบราว์เซอร์แล้วลองอีกครั้ง", true);
  }
}

const commandFeedback = document.querySelector("#command-feedback");
const commandCards = Array.from(document.querySelectorAll(".command-card"));
const commandSearch = document.querySelector("#command-search");
const emptyCommands = document.querySelector("#empty-commands");
const filterButtons = Array.from(document.querySelectorAll(".filter-button"));
let selectedCategory = "all";

function filterCommands() {
  const query = commandSearch.value.trim().toLocaleLowerCase("th");
  let visibleCount = 0;

  commandCards.forEach((card) => {
    const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
    const searchableText = `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase("th");
    const matchesSearch = !query || searchableText.includes(query);
    const isVisible = matchesCategory && matchesSearch;
    card.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  emptyCommands.hidden = visibleCount > 0;
}

commandSearch.addEventListener("input", filterCommands);
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;
      filterButton.classList.toggle("is-active", isSelected);
      filterButton.setAttribute("aria-pressed", String(isSelected));
    });
    filterCommands();
  });
});

document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.dataset.copy;
    copyText(command, commandFeedback, `คัดลอกคำสั่ง ${command} เรียบร้อยแล้ว`);
  });
});

const networkForm = document.querySelector("#network-info-form");
const infoFeedback = document.querySelector("#info-feedback");
const gatewayField = networkForm.elements.gateway;
const gatewayCommand = document.querySelector("#gateway-command");
const gatewayCopyButton = gatewayCommand.closest(".command-card").querySelector(".copy-button");

gatewayField.addEventListener("input", () => {
  const gateway = gatewayField.value.trim() || "192.168.1.1";
  const command = `ping ${gateway}`;
  gatewayCommand.textContent = command;
  gatewayCopyButton.dataset.copy = command;
  persistCurrentData();
});

networkForm.addEventListener("input", persistCurrentData);
networkForm.addEventListener("reset", () => {
  window.setTimeout(() => {
    showFeedback(infoFeedback, "ล้างข้อมูลในแบบฟอร์มเรียบร้อยแล้ว");
    persistCurrentData();
    gatewayCommand.textContent = "ping 192.168.1.1";
    gatewayCopyButton.dataset.copy = "ping 192.168.1.1";
  });
});

document.querySelector("#copy-info").addEventListener("click", () => {
  const formData = new FormData(networkForm);
  const fields = [
    ["ชื่อคอมพิวเตอร์", "computerName"],
    ["IP Address", "ipAddress"],
    ["Subnet Mask", "subnetMask"],
    ["Default Gateway", "gateway"],
    ["DNS Server", "dnsServer"],
    ["บันทึกเพิ่มเติม", "notes"]
  ];
  const formattedText = fields
    .map(([label, name]) => `${label}: ${String(formData.get(name) || "").trim() || "-"}`)
    .join("\n");

  copyText(formattedText, infoFeedback, "คัดลอกข้อมูลเครือข่ายเรียบร้อยแล้ว");
});

const checklistItems = Array.from(document.querySelectorAll(".checklist-item input"));
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const progressCount = document.querySelector("#progress-count");
const overviewProgress = document.querySelector("#overview-progress");

function updateProgress() {
  const completed = checklistItems.filter((checkbox) => checkbox.checked).length;
  const total = checklistItems.length;
  const percentage = total === 0 ? 0 : (completed / total) * 100;

  progressFill.style.width = `${percentage}%`;
  progressTrack.setAttribute("aria-valuenow", String(completed));
  progressCount.textContent = `เสร็จแล้ว ${completed} จาก ${total} ข้อ`;
  overviewProgress.innerHTML = `${completed} <span>จาก ${total} ขั้นตอน</span>`;
}

checklistItems.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    updateProgress();
    persistCurrentData();
  });
});

document.querySelector("#reset-checklist").addEventListener("click", () => {
  checklistItems.forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateProgress();
  persistCurrentData();
});

const notesField = document.querySelector("#quick-notes");
const notesFeedback = document.querySelector("#notes-feedback");
notesField.addEventListener("input", persistCurrentData);
document.querySelector("#copy-notes").addEventListener("click", () => {
  const notes = notesField.value.trim();
  if (!notes) {
    showFeedback(notesFeedback, "กรุณาเขียนบันทึกก่อนคัดลอก", true);
    notesField.focus();
    return;
  }

  copyText(notes, notesFeedback, "คัดลอกบันทึกเรียบร้อยแล้ว");
});

function restoreSavedData() {
  const formValues = savedData.form || {};
  Object.entries(formValues).forEach(([name, value]) => {
    const field = networkForm.elements.namedItem(name);
    if (field) field.value = value;
  });

  const savedChecklist = savedData.checklist || {};
  checklistItems.forEach((checkbox) => {
    checkbox.checked = Boolean(savedChecklist[checkbox.dataset.check]);
  });

  notesField.value = savedData.quickNotes || "";
  const gateway = gatewayField.value.trim();
  if (gateway) {
    const command = `ping ${gateway}`;
    gatewayCommand.textContent = command;
    gatewayCopyButton.dataset.copy = command;
  }
}

restoreSavedData();
updateProgress();

// จัดการลิงก์ค้นหาจากแถบที่อยู่โดยไม่ต้องโหลดหน้าใหม่
function openRequestedSection() {
  const section = document.querySelector(window.location.hash);
  if (section) section.scrollIntoView();
}

window.addEventListener("hashchange", openRequestedSection);
