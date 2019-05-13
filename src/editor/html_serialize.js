export function htmlSerialize(model) {
    return model.parts.reduce((html, part) => {
        switch (part.type) {
            case "newline":
                return html + "<br />";
            case "plain":
            case "pill-candidate":
                return html + part.text;
            case "room-pill":
            case "user-pill":
                return html + `<a href="https://matrix.to/#/${part.resourceId}">${part.text}</a>`;
        }
    }, "");
}
