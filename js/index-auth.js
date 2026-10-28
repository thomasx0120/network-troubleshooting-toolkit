const authGate = document.querySelector("#auth-gate");
const authGateTitle = document.querySelector("#auth-gate-title");
const authGateStatus = document.querySelector("#auth-gate-status");
const retryButton = document.querySelector("#auth-retry");
const loginLink = document.querySelector("#auth-login-link");
const toolkitApp = document.querySelector("#toolkit-app");
const accountStatus = document.querySelector("#account-status");
const accountEmail = document.querySelector("#account-email");
const logoutButton = document.querySelector("#account-logout");
const loginUrl = new URL("../login.html", import.meta.url);
const AUTH_MODULE_URL = new URL("./auth.js", import.meta.url);
const TOOLKIT_SCRIPT_URL = new URL("../script.js?v=4", import.meta.url);
const PERSONAL_SUPPORT_SCRIPT_URL = new URL("./personal-support.js?v=3", import.meta.url);
const AUTH_MODULE_TIMEOUT_MS = 15000;
const SESSION_CHECK_TIMEOUT_MS = 15000;
const TOOLKIT_SCRIPT_TIMEOUT_MS = 15000;

let authModule;
let authModulePromise;
let currentSession = null;
let sessionVerified = false;
let initializationInProgress = false;
let redirectingToLogin = false;
let logoutInProgress = false;
let authModuleLoadAttempt = 0;
let toolkitScriptPromise;
let toolkitLoadAttempt = 0;
let authSubscription;

loginLink.href = loginUrl.href;

function showGateStatus(message, isError = false) {
  authGateStatus.textContent = message;
  authGateStatus.classList.toggle("is-error", isError);
  retryButton.hidden = !isError;
  loginLink.hidden = !isError;
}

function waitFor(promise, timeoutMs, code, message) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(message);
      error.code = code;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function loadAuthModule() {
  if (!authModulePromise) {
    const authModuleUrl = new URL(AUTH_MODULE_URL);
    authModuleUrl.searchParams.set("auth-load", String(++authModuleLoadAttempt));

    authModulePromise = waitFor(
      import(authModuleUrl.href),
      AUTH_MODULE_TIMEOUT_MS,
      "AUTH_MODULE_TIMEOUT",
      `Timed out importing ${authModuleUrl.pathname}`
    ).then((module) => {
      authModule = module;
      return module;
    }).catch((error) => {
      authModulePromise = undefined;
      throw error;
    });
  }

  return authModulePromise;
}

function showAuthError(stage, error, fallbackMessage) {
  console.error(`[Toolkit Auth] ${stage} failed`, error);
  authGateTitle.textContent = stage.startsWith("Toolkit")
    ? "โหลด Toolkit ไม่สำเร็จ"
    : "ยังตรวจสอบ Session ไม่สำเร็จ";

  if (error?.code === "AUTH_MODULE_TIMEOUT") {
    showGateStatus("โหลดโมดูลยืนยันตัวตนใช้เวลานานเกินไป กรุณาตรวจสอบเส้นทาง js/auth.js และลองอีกครั้ง", true);
    return;
  }

  if (error?.code === "AUTH_SESSION_TIMEOUT") {
    showGateStatus("ตรวจสอบ Session ใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตและการตั้งค่า Supabase แล้วลองอีกครั้ง", true);
    return;
  }

  if (error?.code === "TOOLKIT_SCRIPT_TIMEOUT") {
    authGateTitle.textContent = "โหลด Toolkit ไม่สำเร็จ";
    showGateStatus("โหลดไฟล์ script.js ใช้เวลานานเกินไป กรุณาตรวจสอบเส้นทางไฟล์และ Live Server แล้วลองอีกครั้ง", true);
    return;
  }

  const causeMessage = error?.cause?.message;
  const detail = causeMessage && causeMessage !== error.message
    ? ` รายละเอียด: ${causeMessage}`
    : "";
  showGateStatus(`${fallbackMessage}${detail}`, true);
}

function renderSession(session) {
  currentSession = session;
  accountEmail.textContent = session.user.email || "ไม่มีอีเมลในข้อมูลบัญชี";
  accountStatus.textContent = "เข้าสู่ระบบแล้ว";
  accountStatus.classList.remove("is-error");
  accountEmail.hidden = false;
  logoutButton.hidden = false;
  logoutButton.disabled = logoutInProgress;
}

function redirectToLogin() {
  if (redirectingToLogin) return;

  redirectingToLogin = true;
  sessionVerified = false;
  toolkitApp.hidden = true;
  showGateStatus("ไม่พบ Session ที่ใช้งานได้ กำลังเปลี่ยนไปหน้าเข้าสู่ระบบ...");
  window.location.replace(loginUrl.href);
}

function handleAuthStateChange(event, session) {
  if (event === "INITIAL_SESSION") return;

  if (event === "SIGNED_OUT" || !session?.user) {
    redirectToLogin();
    return;
  }

  if (sessionVerified) {
    renderSession(session);
  }
}

function showToolkit() {
  if (redirectingToLogin || !currentSession?.user) return;

  toolkitApp.hidden = false;
  authGate.hidden = true;
}

function loadToolkitScript() {
  if (!toolkitScriptPromise) {
    const scriptUrl = new URL(TOOLKIT_SCRIPT_URL);
    scriptUrl.searchParams.set("auth-load", String(++toolkitLoadAttempt));

    toolkitScriptPromise = waitFor(
      import(scriptUrl.href),
      TOOLKIT_SCRIPT_TIMEOUT_MS,
      "TOOLKIT_SCRIPT_TIMEOUT",
      `Timed out importing ${scriptUrl.pathname}`
    ).then(async () => {
      await import(PERSONAL_SUPPORT_SCRIPT_URL.href);
      showToolkit();
    }).catch((error) => {
      toolkitScriptPromise = undefined;
      showAuthError(
        "Toolkit script import",
        error,
        `โหลดหรือเริ่มต้น ${scriptUrl.pathname} ไม่สำเร็จ (${error.message || "ไม่ทราบสาเหตุ"}) กรุณาตรวจสอบไฟล์และลองอีกครั้ง`
      );
    });
  }

  return toolkitScriptPromise;
}

async function initializeAccount() {
  if (initializationInProgress || redirectingToLogin) return;

  initializationInProgress = true;
  retryButton.disabled = true;
  authGateTitle.textContent = "กำลังตรวจสอบ Session...";
  showGateStatus("กรุณารอสักครู่ก่อนเข้าใช้งาน Toolkit");
  let stage = "Auth module load";

  try {
    const { getSupabaseClient } = await loadAuthModule();
    stage = "Supabase client initialization";
    const supabase = await getSupabaseClient();

    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange(handleAuthStateChange);
      authSubscription = data.subscription;
    }

    stage = "Session check";
    const { data, error } = await waitFor(
      supabase.auth.getSession(),
      SESSION_CHECK_TIMEOUT_MS,
      "AUTH_SESSION_TIMEOUT",
      "Timed out checking Supabase session"
    );
    if (error) {
      throw error;
    }

    if (!data.session?.user) {
      redirectToLogin();
      return;
    }

    sessionVerified = true;
    authGateTitle.textContent = "เข้าสู่ระบบแล้ว";
    authGateStatus.textContent = "กำลังเปิด Toolkit...";
    renderSession(data.session);
    await loadToolkitScript();
  } catch (error) {
    sessionVerified = false;
    const friendlyError = authModule?.getFriendlyAuthError(error) || error.message || "โหลดโมดูลยืนยันตัวตนไม่สำเร็จ";
    showAuthError(
      stage,
      error,
      `${friendlyError} ตรวจสอบรายละเอียดเพิ่มเติมได้ใน Developer Tools > Console`
    );
  } finally {
    initializationInProgress = false;
    retryButton.disabled = false;
  }
}

retryButton.addEventListener("click", initializeAccount);

logoutButton.addEventListener("click", async () => {
  if (logoutInProgress || !sessionVerified) return;

  logoutInProgress = true;
  logoutButton.disabled = true;
  accountStatus.textContent = "กำลังออกจากระบบ...";

  try {
    const { getSupabaseClient } = await loadAuthModule();
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      throw error;
    }

    redirectToLogin();
  } catch (error) {
    logoutInProgress = false;
    if (currentSession?.user && sessionVerified) {
      renderSession(currentSession);
      accountStatus.textContent = authModule?.getFriendlyAuthError(error)
        || error.message
        || "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง";
      accountStatus.classList.add("is-error");
    }
  }
});

initializeAccount();
