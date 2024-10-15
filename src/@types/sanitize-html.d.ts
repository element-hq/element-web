/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import sanitizeHtml from "sanitize-html";

export interface IExtendedSanitizeOptions extends sanitizeHtml.IOptions {
    // This option only exists in 2.x RCs so far, so not yet present in the
    // separate type definition module.
    nestingLimit?: number;
}
