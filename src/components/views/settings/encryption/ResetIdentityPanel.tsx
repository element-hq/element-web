/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Breadcrumb } from "@vector-im/compound-web";
import React, { type JSX } from "react";

import { _t } from "../../../../languageHandler";
import { ResetIdentityBody, type ResetIdentityBodyVariant } from "./ResetIdentityBody";

interface ResetIdentityPanelProps {
    /**
     * Called when the identity is reset.
     */
    onReset: () => void;

    /**
     * Called when the cancel button is clicked or when we go back in the breadcrumbs.
     */
    onCancelClick: () => void;

    /**
     * Which variant of this panel to show.
     */
    variant: ResetIdentityBodyVariant;
}

/**
 * The Encryption Settings panel for resetting the identity of the current user.
 *
 * A thin wrapper around {@link ResetIdentityBody}, just adding breadcrumbs.
 */
export function ResetIdentityPanel({ onCancelClick, onReset, variant }: ResetIdentityPanelProps): JSX.Element {
    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onCancelClick}
                pages={[_t("settings|encryption|title"), _t("settings|encryption|advanced|breadcrumb_page")]}
                onPageClick={onCancelClick}
            />
            <ResetIdentityBody onReset={onReset} onCancelClick={onCancelClick} variant={variant} />
        </>
    );
}
