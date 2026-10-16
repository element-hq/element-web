/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import noLeakedClassTimer from "./NoLeakedClassTimer.ts";
import noLeakedEmitterListener from "./NoLeakedEmitterListener.ts";
import noSubscribeAfterAwait from "./NoSubscribeAfterAwait.ts";
import requireLodashCancel from "./RequireLodashCancel.ts";

/** Lint rules specific to Element Web, loaded by oxlint as a JS plugin. */
const plugin = {
    meta: { name: "element-web" },
    rules: {
        "no-leaked-class-timer": noLeakedClassTimer,
        "no-leaked-emitter-listener": noLeakedEmitterListener,
        "no-subscribe-after-await": noSubscribeAfterAwait,
        "require-lodash-cancel": requireLodashCancel,
    },
};

export default plugin;
