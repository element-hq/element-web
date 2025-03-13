/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { Icon as WarningIcon } from "../../../../../res/img/warning.svg";

interface Props {
    className?: string;
    children: React.ReactNode;
}

const MediaProcessingError: React.FC<Props> = ({ className, children }) => (
    <span className={className}>
        <WarningIcon className="mx_MediaProcessingError_Icon" width="16" height="16" />
        {children}
    </span>
);

export default MediaProcessingError;
