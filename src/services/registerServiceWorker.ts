import { Capacitor } from '@capacitor/core';

/**
 * Registers the PWA service worker so the site is installable ("Add to Home
 * Screen") on Android Chrome and iOS Safari. Skipped inside the Capacitor
 * native apps — they already have a real home-screen icon via the OS.
 */
export function registerServiceWorker(): void {
  if (Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const scope = new URL('.', document.baseURI).toString();
    const swUrl = new URL('sw.js', document.baseURI).toString();
    navigator.serviceWorker.register(swUrl, { scope }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
