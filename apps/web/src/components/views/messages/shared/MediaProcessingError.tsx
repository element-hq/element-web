/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { FileErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface Props {
    className?: string;
    Icon?: typeof FileErrorIcon;
    children: React.ReactNode;
}

const MediaProcessingError: React.FC<Props> = ({ className, children, Icon = FileErrorIcon }) => (
    <span className={className}>
        <Icon className="mx_MediaProcessingError_Icon" width="16" height="16" />
        {children}
    </span>
);

export default MediaProcessingError;
