/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MediaPreviewIcon } from "./MediaPreviewGroupView";
import FileIcon from "@vector-im/compound-design-tokens/assets/web/icons/document";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import React from "react";

export function attachmentIcon(_mimeType?: string): MediaPreviewIcon {
    return {
        icon: <FileIcon />,
        color: "var(--cpd-color-text-decorative-4)",
    };
}

export function linkIcon(): MediaPreviewIcon {
    return {
        icon: <LinkIcon />,
        color: "var(--cpd-color-text-decorative-4)",
    };
}
