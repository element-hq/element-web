/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Breadcrumb } from "@vector-im/compound-web";
import React, { type JSX, type MouseEventHandler } from "react";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { _t } from "../../../../languageHandler";
import { ResetIdentityBody } from "./ResetIdentityBody";

/**
 * Wraps ResetIdentityBody to work in the settings page by adding a breadcrumb.
 */

interface ResetIdentityPanelProps {
    /**
     * Called when the identity is reset.
     */
    onFinish: MouseEventHandler<HTMLButtonElement>;
    /**
     * Called when the cancel button is clicked or when we go back in the breadcrumbs.
     */
    onCancelClick: () => void;

    /**
     * The variant of the panel to show. We show more warnings in the 'compromised' variant (no use in showing a user this
     * warning if they have to reset because they no longer have their key)
     *
     * "compromised" is shown when the user chooses 'reset' explicitly in settings, usually because they believe their
     * identity has been compromised.
     *
     * "forgot" is shown when the user has just forgotten their passphrase.
     */
    variant: "compromised" | "forgot";
}

/**
 * The panel for resetting the identity of the current user.
 */
export function ResetIdentityPanel({ onCancelClick, onFinish, variant }: ResetIdentityPanelProps): JSX.Element {
    const matrixClient = useMatrixClientContext();
    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onCancelClick}
                pages={[_t("settings|encryption|title"), _t("settings|encryption|advanced|breadcrumb_page")]}
                onPageClick={onCancelClick}
            />
            <ResetIdentityBody
                onFinish={onFinish}
                onCancelClick={onCancelClick}
                variant={variant}
                title={
                    variant === "forgot"
                        ? _t("settings|encryption|advanced|breadcrumb_title_forgot")
                        : _t("settings|encryption|advanced|breadcrumb_title")
                }
                client={matrixClient}
            />
        </>
    );
}
