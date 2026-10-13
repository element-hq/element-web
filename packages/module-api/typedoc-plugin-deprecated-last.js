/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CommentTag, Converter } from "typedoc";

/**
 * TypeDoc plugin which places any `@deprecated` reflection without an explicit `@group` into a "Deprecated" group,
 * so that `groupOrder` can push them to the bottom of the docs.
 *
 * @param {import("typedoc").Application} app
 */
export function load(app) {
    app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
        for (const reflection of Object.values(context.project.reflections)) {
            const comment = reflection.comment ?? reflection.signatures?.[0]?.comment;
            if (!comment?.getTag("@deprecated") || comment.getTag("@group")) continue;
            comment.blockTags.push(new CommentTag("@group", [{ kind: "text", text: "Deprecated" }]));
            reflection.comment ??= comment;
        }
    });
}
