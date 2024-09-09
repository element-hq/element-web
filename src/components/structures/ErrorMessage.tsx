/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode } from "react";

import { Icon as WarningBadgeIcon } from "../../../res/img/compound/error-16px.svg";

interface ErrorMessageProps {
    message: string | ReactNode | null;
}

/**
 * Error message component.
 * Reserves two lines to display errors to prevent layout shifts when the error pops up.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    const icon = message ? <WarningBadgeIcon className="mx_Icon mx_Icon_16" /> : null;

    return (
        <div className="mx_ErrorMessage">
            {icon}
            {message}
        </div>
    );
};
