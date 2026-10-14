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
type ChangeRecoveryKeyProps = Omit<ComponentProps<typeof ChangeRecoveryKeyBody>, "className">;

/**
 * The Encryption Settings panel to set up or change the recovery key.
 *
 * A thin wrapper around {@link ChangeRecoveryKeyBody}, just adding breadcrumbs.
 */
export function ChangeRecoveryKey(props: Readonly<ChangeRecoveryKeyProps>): JSX.Element {
    const pages = [
        _t("settings|encryption|title"),
        props.userHasRecoveryKey
            ? _t("settings|encryption|recovery|change_recovery_key")
            : _t("settings|encryption|recovery|set_up_recovery"),
    ];

    const { onCancelClick } = props;
    const onBreadcrumbClick = useCallback(() => {
        logger.debug("ChangeRecoveryKey: user cancelled via the breadcrumbs");
        onCancelClick();
    }, [onCancelClick]);

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onBreadcrumbClick}
                pages={pages}
                onPageClick={onBreadcrumbClick}
            />
            <ChangeRecoveryKeyBody {...props} />
        </>
    );
}
