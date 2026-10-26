// แสดงข้อความตอบกลับโดยแยกสถานะสำเร็จและข้อผิดพลาดให้เห็นชัดเจน
function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

// ใช้ Clipboard API; หากเบราว์เซอร์ไม่อนุญาต จะแจ้งวิธีใช้งานแทนการล้มเหลวเงียบ ๆ
async function copyText(text, feedbackElement, successMessage) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    showFeedback(feedbackElement, "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณาเปิดหน้านี้ผ่าน Live Server หรือคัดลอกข้อความด้วยตนเอง", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showFeedback(feedbackElement, successMessage);
  } catch (error) {
    showFeedback(feedbackElement, "คัดลอกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การใช้คลิปบอร์ดของเบราว์เซอร์แล้วลองอีกครั้ง", true);
  }
}

// ปุ่มคัดลอกคำสั่งทุกใบใช้ตัวจัดการเดียวกัน
const commandFeedback = document.querySelector("#command-feedback");
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copy, commandFeedback, "คัดลอกคำสั่งเรียบร้อยแล้ว");
  });
});

const networkForm = document.querySelector("#network-info-form");
const infoFeedback = document.querySelector("#info-feedback");

networkForm.addEventListener("reset", () => {
  showFeedback(infoFeedback, "ล้างข้อมูลในแบบฟอร์มเรียบร้อยแล้ว");
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

// อัปเดตทั้งแถบความคืบหน้าและข้อความเมื่อมีการเลือกหรือยกเลิกช่องตรวจสอบ
const checklistItems = Array.from(document.querySelectorAll(".checklist-item input"));
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const progressCount = document.querySelector("#progress-count");

function updateProgress() {
  const completed = checklistItems.filter((checkbox) => checkbox.checked).length;
  const total = checklistItems.length;
  const percentage = total === 0 ? 0 : (completed / total) * 100;

  progressFill.style.width = `${percentage}%`;
  progressTrack.setAttribute("aria-valuenow", String(completed));
  progressCount.textContent = `เสร็จแล้ว ${completed} จาก ${total} ข้อ`;
}

checklistItems.forEach((checkbox) => {
  checkbox.addEventListener("change", updateProgress);
});
updateProgress();

const notesField = document.querySelector("#quick-notes");
const notesFeedback = document.querySelector("#notes-feedback");
document.querySelector("#copy-notes").addEventListener("click", () => {
  const notes = notesField.value.trim();
  if (!notes) {
    showFeedback(notesFeedback, "กรุณาเขียนบันทึกก่อนคัดลอก", true);
    notesField.focus();
    return;
  }

  copyText(notes, notesFeedback, "คัดลอกบันทึกเรียบร้อยแล้ว");
});
