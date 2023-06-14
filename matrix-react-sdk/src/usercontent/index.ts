/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

let hasCalled = false;
function remoteRender(event: MessageEvent): void {
    const data = event.data;

    // If we're handling secondary calls, start from scratch
    if (hasCalled) {
        document.body.replaceWith(document.createElement("BODY"));
    }
    hasCalled = true;

    const img: HTMLSpanElement = document.createElement("span"); // we'll mask it as an image
    img.id = "img";

    const a: HTMLAnchorElement = document.createElement("a");
    a.id = "a";
    a.rel = "noreferrer noopener";
    a.download = data.download;
    // @ts-ignore
    a.style = data.style;
    a.style.fontFamily = "Arial, Helvetica, Sans-Serif";
    a.href = window.URL.createObjectURL(data.blob);
    a.appendChild(img);
    a.appendChild(document.createTextNode(data.textContent));

    // Apply image style after so we can steal the anchor's colour.
    // Style copied from a rendered version of mx_MFileBody_download_icon
    if (data.imgStyle) {
        // @ts-ignore
        img.style = data.imgStyle;
    } else {
        img.style.width = "12px";
        img.style.height = "12px";
        img.style.webkitMaskSize = "12px";
        img.style.webkitMaskPosition = "center";
        img.style.webkitMaskRepeat = "no-repeat";
        img.style.display = "inline-block";
        img.style.webkitMaskImage = `url('${data.imgSrc}')`;
        img.style.backgroundColor = `${a.style.color}`;
    }

    const body = document.body;
    // Don't display scrollbars if the link takes more than one line to display.
    body.style.margin = "0px";
    body.style.overflow = "hidden";
    body.appendChild(a);

    if (event.data.auto) {
        a.click(); // try to trigger download automatically
    }
}

window.onmessage = function (e: MessageEvent): void {
    if (e.origin === window.location.origin) {
        if (e.data.blob) remoteRender(e);
    }
};
