/*
 * gsap-shim.js — cross-browser global bridge for the bundled GSAP.
 *
 * client.js is shared verbatim with the Chrome build. It detects the animation
 * library with `if (window.gsap)` and then calls the bare `gsap` global.
 *
 * In the Chrome build, client.js loads GSAP by injecting a remote <script> into
 * the PAGE. That never actually exposes `gsap` to the content script's isolated
 * world, so the animations silently fall back in both browsers.
 *
 * Here we instead bundle gsap.min.js as a content script (see manifest.json),
 * so GSAP runs in the SAME world as client.js. One quirk remains: Firefox
 * content scripts have a sandbox global that is distinct from `window`
 * (globalThis !== window), and GSAP's UMD wrapper attaches to the sandbox
 * global — so `gsap` is defined but `window.gsap` may not be. This shim mirrors
 * it onto `window` so client.js's `window.gsap` checks pass and the animations
 * actually run. In Chrome it's a harmless no-op (window.gsap is already set).
 *
 * Fully guarded: if anything here fails, client.js simply takes its existing
 * no-GSAP fallback paths and the extension keeps working without animation.
 */
(function () {
    try {
        if (typeof window.gsap === "undefined" && typeof gsap !== "undefined") {
            window.gsap = gsap;
        }
    } catch (e) {
        /* graceful degradation — client.js handles a missing window.gsap */
    }
})();
