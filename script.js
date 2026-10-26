const STORAGE_KEY = "networkToolkitData";
let storageReadError = false;
const guideStages = [
  { id: "devices", label: "ตรวจว่ากระทบอุปกรณ์อื่นด้วยหรือไม่" },
  { id: "link", label: "ตรวจสาย LAN หรือ Wi-Fi" },
  { id: "ip", label: "ตรวจ IP Address และ Gateway" },
  { id: "gateway", label: "ทดสอบการเชื่อมต่อ Gateway" },
  { id: "internet", label: "ทดสอบการเชื่อมต่ออินเทอร์เน็ต" },
  { id: "dns", label: "ตรวจการทำงานของ DNS" }
];

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
const guidedForm = document.querySelector("#guided-form");
const guideSelects = Array.from(guidedForm.querySelectorAll("[data-stage]"));
const guideNotes = Array.from(guidedForm.querySelectorAll("[data-stage-note]"));
const guideProgress = document.querySelector("#guide-progress");
const recommendationTitle = document.querySelector("#recommendation-title");
const recommendationBody = document.querySelector("#recommendation-body");
const recommendationPriority = document.querySelector("#recommendation-priority");
const recommendationReason = document.querySelector("#recommendation-reason");
const guideFeedback = document.querySelector("#guide-feedback");

if (storageReadError) {
  savedState.textContent = "ไม่สามารถอ่านข้อมูลเดิมได้";
  notesSaveStatus.textContent = "เบราว์เซอร์ปิดการใช้งานพื้นที่จัดเก็บ";
}

function persistCurrentData() {
  const formData = Object.fromEntries(new FormData(networkForm).entries());
  const checklist = Object.fromEntries(checklistItems.map((checkbox) => [checkbox.dataset.check, checkbox.checked]));
  const guideFormData = Object.fromEntries(new FormData(guidedForm).entries());
  const stages = Object.fromEntries(guideSelects.map((select) => [select.dataset.stage, select.value]));
  const stageNotes = Object.fromEntries(guideNotes.map((input) => [input.dataset.stageNote, input.value]));
  savedData = {
    ...savedData,
    form: formData,
    checklist,
    quickNotes: notesField.value,
    guidedSession: { ...guideFormData, stages, stageNotes }
  };

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
const guideGatewayCommand = document.querySelector("#guide-gateway-command");

gatewayField.addEventListener("input", () => {
  const gateway = gatewayField.value.trim() || "192.168.1.1";
  const command = `ping ${gateway}`;
  gatewayCommand.textContent = command;
  gatewayCopyButton.dataset.copy = command;
  guideGatewayCommand.textContent = command;
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

function getGuideRecommendation() {
  const result = (stage) => guidedForm.querySelector(`[data-stage="${stage}"]`).value;
  const symptom = guidedForm.elements.symptom.value;

  if (result("devices") === "issue") {
    return {
      step: "หยุดแก้เฉพาะเครื่องและตรวจสอบเครือข่ายส่วนกลาง",
      body: "มีอุปกรณ์อื่นพบปัญหาเหมือนกัน ให้ตรวจสถานะ Access Point, Switch หรือ Router และสอบถามทีมดูแลเครือข่ายก่อนรีสตาร์ตหรือเปลี่ยนอุปกรณ์ส่วนกลาง",
      reason: "เมื่อหลายเครื่องมีอาการเดียวกัน สาเหตุมีแนวโน้มอยู่ที่เครือข่ายส่วนกลาง ไม่ใช่คอมพิวเตอร์เครื่องเดียว",
      priority: "ควรแจ้งทีมเครือข่าย"
    };
  }

  if (result("devices") === "todo") {
    return {
      step: guideStages[0].label,
      body: "สอบถามผู้ใช้ใกล้เคียงหรือทดสอบอุปกรณ์อีกเครื่องบนเครือข่ายเดียวกัน แล้วเลือกว่าใช้งานได้ปกติหรือมีปัญหาเหมือนกัน",
      reason: "ตรวจขอบเขตปัญหาก่อน เพื่อแยกปัญหาเฉพาะอุปกรณ์ออกจากเหตุขัดข้องที่กระทบหลายคน",
      priority: "ขั้นที่ 1"
    };
  }

  if (result("link") === "issue") {
    return {
      step: "แก้การเชื่อมต่อสาย LAN หรือ Wi-Fi ก่อน",
      body: "เสียบสายให้แน่น ตรวจไฟสถานะ หรือเชื่อมต่อ Wi-Fi ที่ถูกต้อง เมื่อสถานะเชื่อมต่อแล้วให้บันทึกผลและเริ่มตรวจขั้นถัดไป",
      reason: "หากอุปกรณ์ยังไม่มีลิงก์เครือข่าย คำสั่ง IP และ Ping อาจให้ผลผิดพลาดตามไปด้วย",
      priority: "แก้ก่อนทำขั้นถัดไป"
    };
  }

  if (result("link") === "todo") {
    return {
      step: guideStages[1].label,
      body: "ตรวจสาย LAN และไฟที่พอร์ต หรือดูว่าเชื่อมต่อ Wi-Fi ที่ถูกต้องอยู่ก่อน จากนั้นเลือกผลการตรวจในแบบฟอร์ม",
      reason: "เริ่มจากชั้นกายภาพและสถานะการเชื่อมต่อ เป็นขั้นที่เร็วและแก้ได้ง่ายที่สุด",
      priority: "ขั้นที่ 2"
    };
  }

  if (result("ip") === "issue") {
    return {
      step: "ตรวจการรับ IP และการตั้งค่า DHCP",
      body: "ดูว่า Adapter ที่ใช้งานเปิดอยู่และเลือก DHCP ตามนโยบายองค์กรหรือไม่ ลอง Disconnect/Connect เครือข่ายอีกครั้ง หากเป็นเครื่ององค์กรให้แจ้งผู้ดูแลก่อนเปลี่ยนค่า IP ด้วยตนเอง",
      reason: "ไม่มี Gateway หรือได้ IP ขึ้นต้นด้วย 169.254 มักหมายถึงเครื่องยังรับค่าจากเครือข่ายหรือ DHCP ไม่สำเร็จ",
      priority: "แก้ก่อน Ping"
    };
  }

  if (result("ip") === "todo") {
    return {
      step: guideStages[2].label,
      body: "เปิด Command Prompt แล้วเรียก ipconfig /all ตรวจ IPv4 Address, Subnet Mask และ Default Gateway ของ Adapter ที่เชื่อมต่ออยู่",
      reason: "ต้องทราบ IP และ Gateway ก่อน จึงจะทดสอบเส้นทางภายในได้ถูกต้อง",
      priority: "ขั้นที่ 3"
    };
  }

  if (result("gateway") === "issue") {
    return {
      step: "ตรวจเส้นทางภายในไปยัง Gateway",
      body: "ยืนยันว่า Ping ใช้ Gateway ที่แสดงใน ipconfig /all ตรวจ Wi-Fi/VLAN และลองเชื่อมต่อเครือข่ายใหม่ หากเครื่องอื่นในวงเดียวกันก็ Ping ไม่ได้ ให้แจ้งผู้ดูแลเครือข่าย",
      reason: "เมื่อเครื่องมี IP แต่ติดต่อ Gateway ไม่ได้ ปัญหามักอยู่ระหว่างเครื่องกับเครือข่ายภายใน",
      priority: "ตรวจเครือข่ายภายใน"
    };
  }

  if (result("gateway") === "todo") {
    return {
      step: guideStages[3].label,
      body: "ใช้คำสั่ง Ping ไปยัง Default Gateway ที่แสดงใน ipconfig /all ไม่ใช่ค่าตัวอย่าง หากยังไม่ได้กรอก Gateway สามารถกรอกในส่วนข้อมูลอุปกรณ์ได้",
      reason: "การตอบกลับจาก Gateway ยืนยันว่าเครื่องสื่อสารกับเครือข่ายภายในได้",
      priority: "ขั้นที่ 4"
    };
  }

  if (result("internet") === "issue") {
    return {
      step: "ตรวจเส้นทางออกอินเทอร์เน็ตหรือแจ้งทีมเครือข่าย",
      body: "Gateway ตอบกลับแต่ Public IP ไม่ตอบ ให้ทดสอบกับเครื่องอื่น ตรวจ VPN/Firewall ตามนโยบาย และแนบผล Ping กับเวลาที่เกิดเหตุเพื่อแจ้งผู้ดูแลเครือข่าย",
      reason: "ผลนี้ชี้ว่าภายในเครื่องถึง Gateway แต่เส้นทางออกหรือการกรองทราฟฟิกอาจมีปัญหา ทั้งนี้บางเครือข่ายอาจปิดกั้น Ping",
      priority: "ตรวจเส้นทางภายนอก"
    };
  }

  if (result("internet") === "todo") {
    return {
      step: guideStages[4].label,
      body: "เรียก ping 8.8.8.8 หากไม่ได้รับ Reply ให้ตรวจนโยบาย Firewall หรือสอบถามผู้ดูแล เพราะบางเครือข่ายปิดกั้น ICMP/Ping ได้",
      reason: "เมื่อ Gateway ใช้งานได้ ขั้นนี้ช่วยแยกปัญหาภายในจากการออกอินเทอร์เน็ต",
      priority: "ขั้นที่ 5"
    };
  }

  if (result("dns") === "issue") {
    return {
      step: "ตรวจปัญหา DNS ก่อนเปลี่ยนค่าผู้ให้บริการ",
      body: "บันทึกผล nslookup และ DNS Server ที่ได้รับ จากนั้นลอง ipconfig /flushdns หากเป็นเครื่ององค์กรอย่าเปลี่ยน DNS Server เอง ให้ส่งผลตรวจให้ผู้ดูแลระบบ",
      reason: "Public IP ตอบกลับแต่ค้นหาชื่อโดเมนไม่สำเร็จ มักเกี่ยวข้องกับ DNS หรือการตั้งค่าชื่อโดเมน",
      priority: "แก้ปัญหา DNS"
    };
  }

  if (result("dns") === "todo") {
    return {
      step: guideStages[5].label,
      body: "เรียก nslookup google.com ตรวจว่ามี DNS Server ตอบกลับและแสดง Address หรือไม่ หากเว็บไซต์ที่มีปัญหาเป็นเว็บเฉพาะ ให้ทดสอบชื่อเว็บนั้นเพิ่มเติม",
      reason: "ตรวจ DNS หลังยืนยันว่า Public IP ติดต่อได้ ช่วยจำกัดสาเหตุได้ชัดเจนขึ้น",
      priority: "ขั้นที่ 6"
    };
  }

  const followUp = {
    slow: {
      step: "เก็บข้อมูลช่วงเวลาที่ช้าและเปรียบเทียบสายกับ Wi-Fi",
      body: "ทดสอบความเร็วในช่วงเวลาเกิดเหตุ เปรียบเทียบกับอุปกรณ์อื่น และบันทึกว่าใช้ Wi-Fi หรือสาย LAN ก่อนส่งข้อมูลให้ผู้ดูแลเครือข่าย",
      reason: "ผลทดสอบพื้นฐานผ่านแล้ว จึงควรเก็บข้อมูลเรื่องความเร็ว ความหน่วง และขอบเขตผลกระทบเพิ่มเติม"
    },
    website: {
      step: "ทดสอบเฉพาะเว็บไซต์และตรวจ Proxy/VPN",
      body: "ตรวจชื่อโดเมนของเว็บไซต์ที่มีปัญหาด้วย nslookup ลองอีกเบราว์เซอร์ และตรวจการตั้งค่า Proxy/VPN ตามนโยบายองค์กร",
      reason: "คำสั่งพื้นฐานผ่าน แต่ปัญหายังอาจอยู่ที่เว็บเฉพาะ เบราว์เซอร์ Proxy หรือ VPN"
    },
    dns: {
      step: "ตรวจ DNS ของโดเมนที่มีปัญหาโดยตรง",
      body: "เรียก nslookup ตามด้วยชื่อโดเมนที่เปิดไม่ได้ แล้วเปรียบเทียบผลกับเว็บไซต์อื่น หากเป็นระบบภายใน ให้ส่งชื่อโดเมนและผลตรวจแก่ผู้ดูแล DNS",
      reason: "แม้การทดสอบ DNS เบื้องต้นผ่าน แต่โดเมนของระบบที่มีปัญหาอาจมีข้อมูล DNS เฉพาะ"
    },
    local: {
      step: "ตรวจวงเครือข่ายและการเข้าถึงอุปกรณ์ปลายทาง",
      body: "ยืนยันว่าเครื่องและอุปกรณ์ปลายทางอยู่ในวงเครือข่ายที่เข้าถึงกันได้ แล้วทดสอบ Ping ไปยัง IP ปลายทางและตรวจสถานะ Firewall ตามนโยบาย",
      reason: "การออกอินเทอร์เน็ตปกติไม่ได้ยืนยันว่าเครื่องจะเข้าถึงอุปกรณ์ภายในทุกวงเครือข่ายได้"
    },
    "no-internet": {
      step: "เก็บผลตรวจและสอบถามผู้ใช้เพื่อปิดเคส",
      body: "การเชื่อมต่อพื้นฐานผ่านทุกขั้น ถ้ายังพบอาการ ให้บันทึกเว็บไซต์/แอปที่ใช้ไม่ได้ เวลาเกิดเหตุ และภาพข้อความผิดพลาด แล้วแจ้งทีมดูแลระบบ",
      reason: "ผลทดสอบผ่านช่วยจำกัดปัญหาไปที่บริการเฉพาะ Proxy/VPN หรืออาการที่เกิดเป็นบางช่วง"
    }
  }[symptom];

  return {
    ...followUp,
    priority: "ตรวจพื้นฐานผ่านแล้ว"
  };
}

function updateGuidance() {
  const completed = guideSelects.filter((select) => select.value !== "todo").length;
  guideProgress.textContent = `ทำแล้ว ${completed} จาก ${guideStages.length} ขั้น`;

  const advice = getGuideRecommendation();
  recommendationTitle.textContent = advice.step;
  recommendationBody.textContent = advice.body;
  recommendationReason.textContent = advice.reason;
  recommendationPriority.textContent = advice.priority;

  guideStages.forEach((stage) => {
    const row = guidedForm.querySelector(`[data-step-row="${stage.id}"]`);
    row.classList.toggle("step-is-next", advice.step === stage.label);
    row.classList.toggle("step-is-done", guidedForm.querySelector(`[data-stage="${stage.id}"]`).value === "pass");
  });
}

guidedForm.addEventListener("input", () => {
  updateGuidance();
  persistCurrentData();
});
guidedForm.addEventListener("change", () => {
  updateGuidance();
  persistCurrentData();
});
guidedForm.addEventListener("reset", () => {
  window.setTimeout(() => {
    updateGuidance();
    persistCurrentData();
    showFeedback(guideFeedback, "เริ่มบันทึกปัญหาใหม่เรียบร้อยแล้ว");
  });
});

document.querySelector("#copy-guide-report").addEventListener("click", () => {
  const symptomLabel = guidedForm.elements.symptom.selectedOptions[0].textContent;
  const scopeLabel = guidedForm.elements.scope.selectedOptions[0].textContent;
  const advice = getGuideRecommendation();
  const lines = [
    "รายงานตรวจสอบปัญหาเครือข่าย",
    `อาการ: ${symptomLabel}`,
    `ขอบเขต: ${scopeLabel}`,
    "",
    ...guideStages.map((stage, index) => {
      const status = guidedForm.querySelector(`[data-stage="${stage.id}"]`);
      const note = guidedForm.querySelector(`[data-stage-note="${stage.id}"]`).value.trim();
      return `${index + 1}. ${stage.label}: ${status.selectedOptions[0].textContent}${note ? ` — ${note}` : ""}`;
    }),
    "",
    `ขั้นตอนถัดไปที่แนะนำ: ${advice.step}`,
    advice.body,
    `เหตุผล: ${advice.reason}`
  ];

  copyText(lines.join("\n"), guideFeedback, "คัดลอกรายงานตรวจสอบเรียบร้อยแล้ว");
});

function restoreGuidedSession() {
  const session = savedData.guidedSession || {};
  ["symptom", "scope"].forEach((name) => {
    if (session[name]) guidedForm.elements[name].value = session[name];
  });

  guideSelects.forEach((select) => {
    const savedValue = session.stages?.[select.dataset.stage];
    if (savedValue && Array.from(select.options).some((option) => option.value === savedValue)) {
      select.value = savedValue;
    }
  });

  guideNotes.forEach((input) => {
    input.value = session.stageNotes?.[input.dataset.stageNote] || "";
  });
}

restoreGuidedSession();
const savedGateway = gatewayField.value.trim();
if (savedGateway) guideGatewayCommand.textContent = `ping ${savedGateway}`;
updateGuidance();
