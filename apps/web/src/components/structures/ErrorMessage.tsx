/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { WarningIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface ErrorMessageProps {
    message: string | ReactNode | null;
}

/**
 * Error message component.
 * Reserves two lines to display errors to prevent layout shifts when the error pops up.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    const icon = message ? <WarningIcon className="mx_Icon mx_Icon_16" /> : null;

    return (
        <div className="mx_ErrorMessage">
            {icon}
            {message}
        </div>
    );
};
