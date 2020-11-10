/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import EditorModel from "./model";
import { AllHtmlEntities } from 'html-entities';
import SettingsStore from '../settings/SettingsStore';
import SdkConfig from '../SdkConfig';
import cheerio from 'cheerio';

export function mdSerialize(model: EditorModel) {
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
                return html +
                    `[${part.text.replace(/[[\\\]]/g, c => "\\" + c)}](${makeGenericPermalink(part.resourceId)})`;
        }
    }, "");
}

export function htmlSerializeIfNeeded(model: EditorModel, {forceHTML = false} = {}) {
    let md = mdSerialize(model);

    if (SettingsStore.getValue("feature_latex_maths")) {
        const displayPattern = (SdkConfig.get()['latex_maths_delims'] || {})['display_pattern'] ||
            "\\$\\$(([^$]|\\\\\\$)*)\\$\\$";
        const inlinePattern = (SdkConfig.get()['latex_maths_delims'] || {})['inline_pattern'] ||
            "\\$(([^$]|\\\\\\$)*)\\$";

        md = md.replace(RegExp(displayPattern, "gm"), function(m, p1) {
            const p1e = AllHtmlEntities.encode(p1);
            return `<div data-mx-maths="${p1e}">\n\n</div>\n\n`;
        });

        md = md.replace(RegExp(inlinePattern, "gm"), function(m, p1) {
            const p1e = AllHtmlEntities.encode(p1);
            return `<span data-mx-maths="${p1e}"></span>`;
        });

        // make sure div tags always start on a new line, otherwise it will confuse
        // the markdown parser
        md = md.replace(/(.)<div/g, function(m, p1) { return `${p1}\n<div`; });
    }

    const parser = new Markdown(md);
    if (!parser.isPlainText() || forceHTML) {
        // feed Markdown output to HTML parser
        const phtml = cheerio.load(parser.toHTML(),
            { _useHtmlParser2: true, decodeEntities: false })

        // add fallback output for latex math, which should not be interpreted as markdown
        phtml('div, span').each(function(i, e) {
            const tex = phtml(e).attr('data-mx-maths')
            if (tex) {
                phtml(e).html(`<code>${tex}</code>`)
            }
        });
        return phtml.html();
    }
    // ensure removal of escape backslashes in non-Markdown messages
    if (md.indexOf("\\") > -1) {
        return parser.toPlaintext();
    }
}

export function textSerialize(model: EditorModel) {
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

export function containsEmote(model: EditorModel) {
    return startsWith(model, "/me ", false);
}

export function startsWith(model: EditorModel, prefix: string, caseSensitive = true) {
    const firstPart = model.parts[0];
    // part type will be "plain" while editing,
    // and "command" while composing a message.
    let text = firstPart && firstPart.text;
    if (!caseSensitive) {
        prefix = prefix.toLowerCase();
        text = text.toLowerCase();
    }

    return firstPart && (firstPart.type === "plain" || firstPart.type === "command") && text.startsWith(prefix);
}

export function stripEmoteCommand(model: EditorModel) {
    // trim "/me "
    return stripPrefix(model, "/me ");
}

export function stripPrefix(model: EditorModel, prefix: string) {
    model = model.clone();
    model.removeText({index: 0, offset: 0}, prefix.length);
    return model;
}

export function unescapeMessage(model: EditorModel) {
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
