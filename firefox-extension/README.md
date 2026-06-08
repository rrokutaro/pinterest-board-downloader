# Pinterest Board Downloader — Firefox Add-on

This folder is the **Firefox build** of the extension. It is functionally identical
to the Chrome/Edge build in `../browser-extension`, with a manifest adjusted for
Firefox and GSAP bundled locally (see [What's different](#whats-different-from-the-chrome-build)).

The core feature — downloading Pinterest boards and pins — uses no special browser
APIs (downloads happen entirely in-page via `fetch` + a blob link), so it runs the
same in Firefox as in Chrome.

---

## How to install — load it via `about:debugging`

This works on **any Firefox** and needs no account or signing. **Do not use
`about:addons` → Install Add-on From File** — regular Firefox rejects unsigned add-ons
that way and shows a misleading *"appears to be corrupt"* error. Use `about:debugging`
instead. The only catch: a temporary add-on is removed when you **restart Firefox**,
so you reload it each session.

1. Open `about:debugging` in the address bar.
2. Click **This Firefox** in the left sidebar.
3. Click **Load Temporary Add-on…**.
4. Browse to this `firefox-extension` folder and select **`manifest.json`**
   (selecting any file inside the folder also works).
5. **Grant site access (important — see below).** Then open
   [pinterest.com](https://www.pinterest.com/), open a board, and the
   "Enable Pinterest Board Downloader" bar appears at the bottom.

> After you edit any file, return to `about:debugging` and click **Reload** on the
> add-on to pick up the changes.

### ⚠️ You may need to grant Pinterest access manually

When an MV3 add-on is loaded **temporarily**, Firefox does **not** auto-grant its
host permissions (unlike a normal signed install). If the downloader bar doesn't
show up on Pinterest, grant access manually:

1. Open `about:addons` → **Extensions** → **Pinterest Board Downloader**.
2. Open the **Permissions** tab.
3. Enable access for **`pinterest.com`** (and `i.pinimg.com` if listed).
4. Reload the Pinterest tab.

---

## What's different from the Chrome build

`client.js` and the icons are **byte-identical** to `../browser-extension`. Only the
manifest and GSAP loading differ:

| | Chrome build | Firefox build |
|---|---|---|
| Manifest | MV3 | MV3 + `browser_specific_settings.gecko` (id, `strict_min_version: 140.0`) |
| `downloads` permission | declared (unused) | **removed** — downloads use an in-page blob link, no permission needed |
| `host_permissions` | long list of pinterest TLDs | trimmed to `pinterest.com` + `i.pinimg.com` (the content script only matches `.com`; in MV3, host permissions don't grant content-script cross-origin fetch anyway) |
| GSAP animations | injected from a CDN into the page (blocked by Pinterest's CSP; also invisible to the content script) | **bundled locally** as a content script + `gsap-shim.js`, so the UI animations actually run and there's no remote-code dependency |

Everything else — shift+right-click selection, marquee, Download All, Endless Mode,
import/export history — behaves the same.

---

## Notes & troubleshooting

- **Nothing appears on Pinterest** → grant `pinterest.com` access in `about:addons`
  (see the warning above), then reload the tab. Also confirm you're on a
  `https://www.pinterest.com/...` page (the `.com` domain).
- **Add-on gone after restart** → expected for temporary loads; just reload it via
  `about:debugging` again.
- **Image downloads work but some videos fail** → Pinterest serves media from
  `i.pinimg.com`; the in-page `fetch` succeeds only when that CDN returns permissive
  CORS headers. Images are reliable; certain video/HLS sources may not download.
- **Privacy** → the add-on stores download history in the page's `localStorage` only;
  it makes no external calls beyond Pinterest's own image/API hosts.
