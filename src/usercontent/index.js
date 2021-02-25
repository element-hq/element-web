function remoteRender(event) {
    const data = event.data;

    const img = document.createElement("img");
    img.id = "img";
    img.src = data.imgSrc;
    img.style = data.imgStyle;

    const a = document.createElement("a");
    a.id = "a";
    a.rel = "noreferrer noopener";
    a.download = data.download;
    a.style = data.style;
    a.style.fontFamily = "Arial, Helvetica, Sans-Serif";
    a.href = window.URL.createObjectURL(data.blob);
    a.appendChild(img);
    a.appendChild(document.createTextNode(data.textContent));

    const body = document.body;
    // Don't display scrollbars if the link takes more than one line to display.
    body.style = "margin: 0px; overflow: hidden";
    body.appendChild(a);

    if (event.data.auto) {
        a.click(); // try to trigger download automatically
    }
}

function remoteSetTint(event) {
    const data = event.data;

    const img = document.getElementById("img");
    img.src = data.imgSrc;
    img.style = data.imgStyle;

    const a = document.getElementById("a");
    a.style = data.style;
}

window.onmessage = function(e) {
    if (e.origin === window.location.origin) {
        if (e.data.blob) remoteRender(e);
        else remoteSetTint(e);
    }
};
