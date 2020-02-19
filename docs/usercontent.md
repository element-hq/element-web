# Usercontent

While decryption itself is safe to be done without a sandbox,
letting the browser and user interact with the resulting data may be dangerous,
previously `usercontent.riot.im` was used to act as a sandbox on a different origin to close the attack surface,
it is now possible to do by using a combination of a sandboxed iframe and some code written into the app which consumes this SDK.

Usercontent is an iframe sandbox target for allowing a user to safely download a decrypted attachment from a sandboxed origin where it cannot be used to XSS your riot session out from under you.

Its function is to create an Object URL for the user/browser to use but bound to an origin different to that of the riot instance to protect against XSS.

It exposes a function over a postMessage API, when sent an object with the matching fields to render a download link with the Object URL:

```json5
{
    "imgSrc": "", // the src of the image to display in the download link
    "imgStyle": "", // the style to apply to the image
    "style":  "", // the style to apply to the download link
    "download": "", // download attribute to pass to the <a/> tag
    "textContent": "", // the text to put inside the download link
    "blob": "", // the data blob to wrap in an object url and allow the user to download
}
```

If only imgSrc, imgStyle and style are passed then just update the existing link without overwriting other things about it.

It is expected that this target be available at `usercontent/` relative to the root of the app, this can be seen in riot-web's webpack config.
