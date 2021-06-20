function remoteRender(event) {
    const data = event.data;

    const img = document.createElement("span"); // we'll mask it as an image
    img.id = "img";

    const a = document.createElement("a");
    a.id = "a";
    a.rel = "noreferrer noopener";
    a.download = data.download;
    a.style = data.style;
    a.style.fontFamily = "Arial, Helvetica, Sans-Serif";
    a.href = window.URL.createObjectURL(data.blob);
    a.appendChild(img);
    a.appendChild(document.createTextNode(data.textContent));

    // Apply image style after so we can steal the anchor's colour.
    // Style copied from a rendered version of mx_MFileBody_download_icon
    img.style = (data.imgStyle || "" +
        "width: 12px; height: 12px;" +
        "-webkit-mask-size: 12px;" +
        "mask-size: 12px;" +
        "-webkit-mask-position: center;" +
        "mask-position: center;" +
        "-webkit-mask-repeat: no-repeat;" +
        "mask-repeat: no-repeat;" +
        "display: inline-block;") + "" +

        // Always add these styles
        `-webkit-mask-image: url('${data.imgSrc}');` +
        `mask-image: url('${data.imgSrc}');` +
        `background-color: ${a.style.color};`;

    const body = document.body;
    // Don't display scrollbars if the link takes more than one line to display.
    body.style = "margin: 0px; overflow: hidden";
    body.appendChild(a);

    if (event.data.auto) {
        a.click(); // try to trigger download automatically
    }
}

window.onmessage = function(e) {
    if (e.origin === window.location.origin) {
        if (e.data.blob) remoteRender(e);
    }
};
