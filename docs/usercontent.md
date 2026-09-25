# Usercontent

While decryption itself is safe to be done without a sandbox,
letting the browser and user interact with the resulting data may be dangerous,
previously `usercontent.riot.im` was used to act as a sandbox on a different origin to close the attack surface,
it is now possible to do by using a combination of a sandboxed iframe and some code written into the app which consumes this SDK.

Usercontent is an iframe sandbox target for allowing a user to safely download a decrypted attachment from a sandboxed origin where it cannot be used to XSS your Element session out from under you.

Its function is to create an Object URL for the user/browser to use but bound to an origin different to that of the Element instance to protect against XSS.

It exposes a function over a postMessage API, when sent an object with the matching fields to render a download link with the Object URL:

```json5
{
    imgSrc: "", // the src of the image to display in the download link
    imgStyle: "", // the style to apply to the image
    style: "", // the style to apply to the download link
    download: "", // download attribute to pass to the <a/> tag
    textContent: "", // the text to put inside the download link
    blob: "", // the data blob to wrap in an object url and allow the user to download
}
```

If only imgSrc, imgStyle and style are passed then just update the existing link without overwriting other things about it.

It is expected that this target be available at `usercontent/` relative to the root of the app, this can be seen in element-web's webpack config.

## PDF viewer

The PDF viewer (behind the `feature_pdf_viewer` lab) renders documents with [pdf.js](https://mozilla.github.io/pdf.js/),
using the same technique: the document is drawn inside a second usercontent target, expected at `usercontent/pdf/`
relative to the root of the app, embedded as an iframe with `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`.
Without `allow-same-origin` the iframe gets an opaque origin, so everything pdf.js builds from the untrusted
document — the canvases, the selectable text layer, link annotations, and the worker that parses the file —
is kept away from the app's storage, session and DOM. Popups are allowed so that a link in a document can open
in a new tab, and leave the iframe's restrictions behind so that the tab it opens is an ordinary one.

The app (`PdfViewer.tsx`) fetches and decrypts the attachment, checks its size and signature, and then talks to
the iframe over postMessage. The protocol is defined in `src/usercontent/pdf/protocol.ts`; in short, the app sends

```json5
{ type: "load", data: ArrayBuffer, position: { page, scale, left, top } } // the document, and where to open it
{ type: "go_to_page", page: 3 }
```

and the iframe answers with `ready`, `loaded` (page count), `page` (the page now at the top), `position` (the
reading position to remember) and `error`. The iframe posts `ready` to its parent, addressed to the origin it was
served by, with one end of a `MessageChannel`; everything else travels over that channel, so no message needs a
wildcard target. The app only takes the port from a `ready` posted by its own iframe's window with the `"null"`
origin a sandboxed iframe has, and both sides check the shape of every message before acting on it.

Two consequences of the opaque origin are worth knowing about:

- A worker's script has to be same-origin with the document starting it, and nothing the app serves is
  same-origin with an opaque origin. pdf.js's worker is therefore bundled into the iframe's script as a string
  and started from a blob URL. Chromium will not start a module worker from a blob URL in an iframe with an opaque origin,
  so a one-line classic worker `import()`s it instead, which all engines accept.
- `'self'` in a Content-Security-Policy has no meaning for an opaque origin (WebKit refuses the iframe's own
  scripts under it), so the iframe's policy is applied from its script once everything it needs from the app
  has loaded. From then on the iframe may start blob workers and use inline styles, and nothing else: no fetch,
  image, script or form can carry a decrypted document anywhere.
