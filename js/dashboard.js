import { getFriendlyAuthError, getSupabaseClient } from "./auth.js";

const dashboardStatus = document.querySelector("#dashboard-status");
const dashboardContent = document.querySelector("#dashboard-content");
const accountEmail = document.querySelector("#account-email");
const logoutButton = document.querySelector("#logout-button");
const logoutFeedback = document.querySelector("#logout-feedback");
const loginLink = document.querySelector("#login-link");
const retryButton = document.querySelector("#dashboard-retry");

let redirectingToLogin = false;
let logoutInProgress = false;
let authSubscription;

function redirectToLogin() {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  window.location.replace("login.html");
}

function showStatus(message, isError = false) {
  dashboardStatus.textContent = message;
  dashboardStatus.classList.toggle("is-error", isError);
  dashboardStatus.hidden = false;
}

function showDashboard(session) {
  accountEmail.textContent = session.user.email || "ไม่มีอีเมลในข้อมูลบัญชี";
  dashboardStatus.hidden = true;
  dashboardContent.hidden = false;
  retryButton.hidden = true;
  loginLink.hidden = true;
}

async function initializeDashboard() {
  dashboardContent.hidden = true;
  logoutButton.disabled = true;
  retryButton.disabled = true;
  retryButton.hidden = true;
  loginLink.hidden = true;
  showStatus("กำลังตรวจสอบ Session...");

  try {
    const supabase = await getSupabaseClient();

    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" && !session) {
          dashboardContent.hidden = true;
          redirectToLogin();
        }
      });
      authSubscription = data.subscription;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      showStatus(`${getFriendlyAuthError(error)} ยังยืนยันสถานะบัญชีไม่ได้ จึงซ่อน Dashboard ไว้`, true);
      retryButton.hidden = false;
      retryButton.disabled = false;
      loginLink.hidden = false;
      return;
    }

    if (!data.session) {
      redirectToLogin();
      return;
    }

    showDashboard(data.session);
    logoutButton.disabled = false;
  } catch (error) {
    dashboardContent.hidden = true;
    logoutButton.disabled = true;
    showStatus(`${getFriendlyAuthError(error)} ยังยืนยันสถานะบัญชีไม่ได้ จึงซ่อน Dashboard ไว้`, true);
    retryButton.hidden = false;
    retryButton.disabled = false;
    loginLink.hidden = false;
  }
}

retryButton.addEventListener("click", initializeDashboard);

logoutButton.addEventListener("click", async () => {
  if (logoutInProgress) return;
  logoutInProgress = true;
  logoutButton.disabled = true;
  logoutFeedback.textContent = "กำลังออกจากระบบ...";
  logoutFeedback.classList.remove("is-error");

  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      logoutFeedback.textContent = getFriendlyAuthError(error);
      logoutFeedback.classList.add("is-error");
      logoutInProgress = false;
      logoutButton.disabled = false;
      return;
    }

    redirectToLogin();
  } catch (error) {
    logoutFeedback.textContent = getFriendlyAuthError(error);
    logoutFeedback.classList.add("is-error");
    logoutInProgress = false;
    logoutButton.disabled = false;
  }
});

initializeDashboard();
