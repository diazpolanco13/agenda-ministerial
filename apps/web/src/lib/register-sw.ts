export function registerServiceWorker(): void {
  if (
    import.meta.env.DEV ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registro silencioso: no bloquear la aplicación si el navegador restringe SW.
    });
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}
