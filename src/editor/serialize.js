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

import Markdown from '../Markdown';
import {makeGenericPermalink} from "../utils/permalinks/Permalinks";

export function mdSerialize(model) {
    return model.parts.reduce((html, part) => {
        switch (part.type) {
            case "newline":
                return html + "\n";
            case "plain":
            case "command":
            case "pill-candidate":
            case "at-room-pill":
                return html + part.text;
            case "room-pill":
            case "user-pill":
                return html + `[${part.text}](${makeGenericPermalink(part.resourceId)})`;
        }
    }, "");
}

export function htmlSerializeIfNeeded(model, {forceHTML = false} = {}) {
    const md = mdSerialize(model);
    const parser = new Markdown(md);
    if (!parser.isPlainText() || forceHTML) {
        return parser.toHTML();
    }
    // Format "plain" text to ensure removal of backslash escapes
    // https://github.com/vector-im/riot-web/issues/11230
    // https://github.com/vector-im/riot-web/issues/2870
    const postParsePlaintext = parser.toPlaintext();
    if (postParsePlaintext !== md) {
        // only return "formatted" text if it differs from the source text
        return postParsePlaintext;
    }
}

export function textSerialize(model) {
    return model.parts.reduce((text, part) => {
        switch (part.type) {
            case "newline":
                return text + "\n";
            case "plain":
            case "command":
            case "pill-candidate":
            case "at-room-pill":
                return text + part.text;
            case "room-pill":
            case "user-pill":
                return text + `${part.text}`;
        }
    }, "");
}

export function containsEmote(model) {
    return startsWith(model, "/me ");
}

export function startsWith(model, prefix) {
    const firstPart = model.parts[0];
    // part type will be "plain" while editing,
    // and "command" while composing a message.
    return firstPart &&
        (firstPart.type === "plain" || firstPart.type === "command") &&
        firstPart.text.startsWith(prefix);
}

export function stripEmoteCommand(model) {
    // trim "/me "
    return stripPrefix(model, "/me ");
}

export function stripPrefix(model, prefix) {
    model = model.clone();
    model.removeText({index: 0, offset: 0}, prefix.length);
    return model;
}

export function unescapeMessage(model) {
    const {parts} = model;
    if (parts.length) {
        const firstPart = parts[0];
        // only unescape \/ to / at start of editor
        if (firstPart.type === "plain" && firstPart.text.startsWith("\\/")) {
            model = model.clone();
            model.removeText({index: 0, offset: 0}, 1);
        }
    }
    return model;
}
