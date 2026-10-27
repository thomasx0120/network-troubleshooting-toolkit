import { getFriendlyAuthError, getSupabaseClient } from "./auth.js";

const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#login-button");
const loginButtonLabel = document.querySelector("#login-button-label");
const loginFeedback = document.querySelector("#login-feedback");
const retryButton = document.querySelector("#auth-retry");
let isBusy = true;

function setBusy(isBusy, label = "เข้าสู่ระบบ") {
  loginButton.disabled = isBusy;
  emailInput.disabled = isBusy;
  passwordInput.disabled = isBusy;
  loginButtonLabel.textContent = label;
  retryButton.disabled = isBusy;
}

function showFeedback(message, isError = false) {
  loginFeedback.textContent = message;
  loginFeedback.classList.toggle("is-error", isError);
}

async function initializeLogin() {
  isBusy = true;
  setBusy(true, "กำลังตรวจสอบ Session...");
  retryButton.hidden = true;
  showFeedback("");

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      showFeedback(getFriendlyAuthError(error), true);
      retryButton.hidden = false;
      retryButton.disabled = false;
      return;
    }

    if (data.session) {
      window.location.replace("dashboard.html");
      return;
    }

    isBusy = false;
    setBusy(false);
  } catch (error) {
    showFeedback(getFriendlyAuthError(error), true);
    retryButton.hidden = false;
    retryButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy || loginButton.disabled) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showFeedback("กรุณากรอกอีเมลและรหัสผ่าน", true);
    return;
  }

  showFeedback("");
  isBusy = true;
  setBusy(true, "กำลังเข้าสู่ระบบ...");

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showFeedback(getFriendlyAuthError(error), true);
      isBusy = false;
      setBusy(false);
      passwordInput.focus();
      return;
    }

    if (!data.session) {
      showFeedback("ยังยืนยัน Session ไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง", true);
      isBusy = false;
      setBusy(false);
      return;
    }

    window.location.replace("dashboard.html");
  } catch (error) {
    showFeedback(getFriendlyAuthError(error), true);
    isBusy = false;
    setBusy(false);
  }
});

retryButton.addEventListener("click", initializeLogin);
initializeLogin();
