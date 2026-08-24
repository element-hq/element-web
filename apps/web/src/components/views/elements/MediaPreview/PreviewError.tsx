/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { FileErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";

/**
 * Shown when we cannot render a file: the fetch or decryption failed, the document would not
 * parse, or we have no previewer for the format. The shell's download button remains available.
 */
export function PreviewError(): JSX.Element {
    return (
        <div className="mx_MediaPreview_error">
            <FileErrorIcon width="48px" height="48px" />
            <span>{_t("media_preview|error_unavailable")}</span>
        </div>
    );
}
