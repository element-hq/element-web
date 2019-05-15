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

export function textSerialize(model) {
    return model.parts.reduce((text, part) => {
        switch (part.type) {
            case "newline":
                return text + "\n";
            case "plain":
            case "pill-candidate":
                return text + part.text;
            case "room-pill":
            case "user-pill":
                return text + `${part.resourceId}`;
        }
    }, "");
}

export function requiresHtml(model) {
    return model.parts.some(part => {
        switch (part.type) {
            case "newline":
            case "plain":
            case "pill-candidate":
                return false;
            case "room-pill":
            case "user-pill":
                return true;
        }
    });
}
