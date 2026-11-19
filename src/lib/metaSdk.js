let sdkPromise;

export function loadMetaSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        try {
          window.FB.init({ appId: import.meta.env.VITE_META_APP_ID, version: "v27.0" });
          resolve(window.FB);
        } catch (error) {
          script.remove();
          reject(error);
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Não foi possível carregar a integração com a Meta."));
      };
      document.head.append(script);
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

export function loginForCode(configId, extras) {
  return new Promise((resolve, reject) => {
    window.FB.login((response) => {
      const code = response?.authResponse?.code;
      if (code) resolve(code);
      else reject(new Error("A autorização na Meta não foi concluída."));
    }, {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras,
    });
  });
}

export function listenForWhatsAppSignup(onFinish) {
  function handleMessage(event) {
    if (!/^https:\/\/(?:[a-z0-9-]+\.)*facebook\.com$/i.test(event.origin)) return;

    let message;
    try {
      message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }

    if (message?.type !== "WA_EMBEDDED_SIGNUP" || message.event !== "FINISH") return;
    const { waba_id: wabaId, phone_number_id: phoneNumberId } = message.data ?? {};
    if (typeof wabaId === "string" && wabaId && typeof phoneNumberId === "string" && phoneNumberId) {
      onFinish({ wabaId, phoneNumberId });
    }
  }
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}

export async function authorizeWhatsApp(configId, signal) {
  let stopListening;
  let rejectSignup;
  let finishTimeout;
  const signup = new Promise((resolve, reject) => {
    stopListening = listenForWhatsAppSignup((account) => {
      stopListening();
      resolve(account);
    });
    rejectSignup = reject;
  });
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });

  try {
    signal.throwIfAborted();
    const login = loginForCode(configId, { setup: {} }).then((code) => {
      if (!signal.aborted) {
        finishTimeout = setTimeout(() => {
          rejectSignup(new Error("A Meta não enviou os dados do número. Tente novamente."));
        }, 5000);
      }
      return code;
    });
    const [code, account] = await Promise.race([Promise.all([login, signup]), cancelled]);
    return { code, ...account };
  } finally {
    clearTimeout(finishTimeout);
    stopListening();
    signal.removeEventListener("abort", abort);
  }
}
