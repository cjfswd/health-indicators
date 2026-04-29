import { component$, useVisibleTask$, useSignal } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

declare global {
  interface Window {
    google?: any;
    handleGoogleCredential?: (response: any) => void;
  }
}

export default component$(() => {
  const error = useSignal("");
  const loading = useSignal(false);

  useVisibleTask$(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // Define the callback globally
    window.handleGoogleCredential = async (response: any) => {
      loading.value = true;
      error.value = "";

      try {
        const res = await fetch("/api/auth/google/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          window.location.href = "/";
        } else {
          error.value = data.error || "Erro na autenticação.";
          loading.value = false;
        }
      } catch {
        error.value = "Erro de conexão. Tente novamente.";
        loading.value = false;
      }
    };

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleCredential,
        auto_select: true,
      });
      window.google?.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        {
          theme: "outline",
          size: "large",
          width: 320,
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
        }
      );
      // Also show One Tap prompt
      window.google?.accounts.id.prompt();
    };
    document.head.appendChild(script);
  });

  return (
    <div
      class="card"
      style={{
        width: "100%",
        maxWidth: "420px",
        padding: "40px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div class="flex items-center justify-center mb-6">
        <img
          src="/images/logo.png"
          alt="Health Indicators"
          width={220}
          height={70}
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Description */}
      <p
        class="text-sm mb-6"
        style={{ color: "var(--text-secondary)", margin: "0 0 24px" }}
      >
        Faça login com sua conta Google corporativa
        <br />
        <span class="text-xs" style={{ color: "var(--text-tertiary)" }}>
          @healthmaiscuidados.com
        </span>
      </p>

      {/* Google Sign-In Button */}
      <div
        class="flex justify-center mb-4"
        style={{ minHeight: "44px" }}
      >
        {loading.value ? (
          <div class="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <div
              class="animate-spin rounded-full border-2"
              style={{
                width: "20px",
                height: "20px",
                borderColor: "var(--border-default)",
                borderTopColor: "var(--color-primary-500)",
              }}
            />
            <span class="text-sm">Autenticando...</span>
          </div>
        ) : (
          <div id="google-signin-btn" />
        )}
      </div>

      {/* Error message */}
      {error.value && (
        <div
          class="rounded-lg p-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            marginTop: "12px",
          }}
        >
          {error.value}
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Login — Health Indicators",
  meta: [
    { name: "description", content: "Acesse o Health Indicators com sua conta Google." },
  ],
};
