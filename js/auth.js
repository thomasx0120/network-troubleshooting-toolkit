import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase URL หรือ Publishable key ยังไม่ได้ตั้งค่า");
}

const SDK_URL = "https://esm.sh/@supabase/supabase-js@2.118.0";
const SDK_LOAD_TIMEOUT_MS = 15000;
let clientPromise;

function createSdkLoadError(cause) {
  const error = new Error("ไม่สามารถโหลด Supabase Client ได้");
  error.code = "SUPABASE_SDK_LOAD_FAILED";
  error.cause = cause;
  return error;
}

export function getSupabaseClient() {
  if (!clientPromise) {
    let timeoutId;
    let timedOut = false;
    const sdkPromise = import(SDK_URL).then(({ createClient }) => {
      if (timedOut || typeof createClient !== "function") {
        throw createSdkLoadError();
      }

      return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
    });
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        reject(createSdkLoadError());
      }, SDK_LOAD_TIMEOUT_MS);
    });

    clientPromise = Promise.race([sdkPromise, timeoutPromise])
      .catch((cause) => {
        throw createSdkLoadError(cause);
      })
      .finally(() => window.clearTimeout(timeoutId));

    clientPromise.catch(() => {
      clientPromise = undefined;
    });
  }

  return clientPromise;
}

export function getFriendlyAuthError(error) {
  if (error?.code === "SUPABASE_SDK_LOAD_FAILED") {
    return "โหลดระบบยืนยันตัวตนไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดลองใหม่หรือโหลดหน้าอีกครั้ง";
  }

  const message = String(error?.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  }
  if (message.includes("email not confirmed")) {
    return "บัญชียังยืนยันอีเมลไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "เชื่อมต่อบริการไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
  }

  return "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ";
}
