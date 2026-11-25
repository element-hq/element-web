/*
 * Copyright 2025 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX, useCallback } from "react";
import { Breadcrumb } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import { ChangeRecoveryKeyBody } from "./ChangeRecoveryKeyBody";

// Same props as the body, minus the class name, which the settings panel does not need
type ChangeRecoveryKeyProps = Omit<ComponentProps<typeof ChangeRecoveryKeyBody>, "dialog">;

/**
 * The Encryption Settings panel to set up or change the recovery key.
 *
 * A thin wrapper around {@link ChangeRecoveryKeyBody}, just adding breadcrumbs.
 */
export function ChangeRecoveryKey(props: Readonly<ChangeRecoveryKeyProps>): JSX.Element {
    const { onCancelClick } = props;
    const onBreadcrumbClick = useCallback(() => {
        logger.debug("ChangeRecoveryKey: user cancelled via the breadcrumbs");
        onCancelClick();
    }, [onCancelClick]);

    return (
        <>
            <ChangeRecoveryKeyBreadcrumb userHasRecoveryKey={props.userHasRecoveryKey} onClick={onBreadcrumbClick} />
            <ChangeRecoveryKeyBody {...props} />
        </>
    );
}

interface ChangeRecoveryKeyBreadcrumbProps {
    /**
     * Whether the user already has a recovery key, which picks the page name (changing the recovery key
     * versus setting up recovery).
     */
    userHasRecoveryKey: boolean;
    /**
     * Called when the back button or the "Encryption" page is clicked.
     */
    onClick: () => void;
}

/**
 * The breadcrumbs of the recovery key flow in the Encryption Settings, from the key form to the confirmation.
 */
export function ChangeRecoveryKeyBreadcrumb({
    userHasRecoveryKey,
    onClick,
}: Readonly<ChangeRecoveryKeyBreadcrumbProps>): JSX.Element {
    let currentPage: string;
    if (userHasRecoveryKey) {
        currentPage = _t("settings|encryption|recovery|change_recovery_key");
    } else {
        currentPage = _t("settings|encryption|recovery|set_up_recovery");
    }

    return (
        <Breadcrumb
            backLabel={_t("action|back")}
            onBackClick={onClick}
            pages={[_t("settings|encryption|title"), currentPage]}
            onPageClick={onClick}
        />
    );
}
