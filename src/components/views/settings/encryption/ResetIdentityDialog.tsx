/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler } from "react";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { ResetIdentityBody } from "./ResetIdentityBody";

interface ResetIdentityDialogProps {
    /**
     * Called when the dialog closes.
     */
    onFinished: () => void;
    /**
     * Called when the identity is reset.
     */
    onResetFinished: MouseEventHandler<HTMLButtonElement>;
    /**
     * Called when the cancel button is clicked.
     */
    onCancelClick: () => void;

    /**
     * The title to display for the panel.
     */
    title: string;

    /**
     * The variant of the panel to show. We show more warnings in the 'compromised' variant (no use in showing a user this
     * warning if they have to reset because they no longer have their key)
     * "compromised" is shown when the user chooses 'reset' explicitly in settings, usually because they believe their
     * identity has been compromised.
     * "forgot" is shown when the user has just forgotten their passphrase.
     */
    variant: "compromised" | "forgot";
}

/**
 * The dialog for resetting the identity of the current user.
 */
export function ResetIdentityDialog({
    onFinished,
    onCancelClick,
    onResetFinished,
    title,
    variant,
}: ResetIdentityDialogProps): JSX.Element {
    const client = MatrixClientPeg.safeGet();

    // wrappers for ResetIdentityBody's callbacks so that onFinish gets called
    // whenever the reset is done, whether by completing successfully, or by
    // being cancelled
    const onResetWrapper: MouseEventHandler<HTMLButtonElement> = (...args) => {
        onFinished();
        onResetFinished(...args);
    };
    const onCancelWrapper: () => void = () => {
        onFinished();
        onCancelClick();
    };
    return (
        <ResetIdentityBody
            onFinish={onResetWrapper}
            onCancelClick={onCancelWrapper}
            variant={variant}
            title={title}
            client={client}
        />
    );
}
