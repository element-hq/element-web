/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createElement, Fragment, type ReactNode } from "react";
import type { Api } from "@element-hq/element-web-module-api";

import Translations from "../translations.json";

type Tags = Record<string, ReactNode | ((sub: string) => ReactNode)>;

/**
 * Translate a key with the English strings of the module, replacing `%(name)s` placeholders
 * and `<tag>text</tag>` tags like Element Web does.
 */
function translate(key: string, variables?: Record<string, string | number>, tags?: Tags): ReactNode {
    const template = (Translations as Record<string, { en: string }>)[key]?.en ?? key;
    const text = template.replace(/%\((\w+)\)s/g, (match, name) => String(variables?.[name] ?? match));
    if (!tags) return text;

    // Splitting on `<tag>text</tag>` or `<tag/>` gives [text, tag name, inner text, self-closing tag name, text, ...]
    const parts = text.split(/<(\w+)>(.*?)<\/\1>|<(\w+)\s*\/>/);
    const nodes: ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 4) {
        nodes.push(parts[i]);
        if (i + 1 >= parts.length) break;

        const name = parts[i + 1] ?? parts[i + 3];
        const inner = parts[i + 2] ?? "";
        const tag = tags[name];
        nodes.push(typeof tag === "function" ? tag(inner) : (tag ?? inner));
    }
    return createElement(Fragment, null, ...nodes);
}

/**
 * A fake module API for tests, only implementing what the components use.
 */
// Cast because only a small part of the API is needed by the components
export const mockApi = {
    i18n: { translate },
} as unknown as Api;
