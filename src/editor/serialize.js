/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
