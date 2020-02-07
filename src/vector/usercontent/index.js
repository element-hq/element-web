var params = window.location.search.substring(1).split('&');
var lockOrigin;
for (var i = 0; i < params.length; ++i) {
    var parts = params[i].split('=');
    if (parts[0] === 'origin') lockOrigin = decodeURIComponent(parts[1]);
}

function remoteRender(event) {
    const data = event.data;

    const img = document.createElement("img");
    img.id = "img";
    img.src = data.imgSrc;

    const a = document.createElement("a");
    a.id = "a";
    a.rel = data.rel;
    a.target = data.target;
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
    if (lockOrigin === undefined || e.origin === lockOrigin) {
        if (e.data.blob) remoteRender(e);
        else remoteSetTint(e);
    }
};
