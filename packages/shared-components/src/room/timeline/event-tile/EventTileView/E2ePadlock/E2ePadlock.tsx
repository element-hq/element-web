/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2025 Vector Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2015-2023 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";
import { ErrorSolidIcon, InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../../core/i18n/i18n";
import styles from "./E2ePadlock.module.css";

/**
 * The icon to display in an {@link E2ePadlock}.
 */
export enum E2ePadlockIcon {
    /** Compound Info icon in grey */
    Normal = "normal",

    /** Compound ErrorSolid icon in red */
    Warning = "warning",

    /** Compound ErrorSolid icon in grey */
    DecryptionFailure = "decryption_failure",
}

export interface E2ePadlockProps {
    /** The icon to display. */
    icon: E2ePadlockIcon;

    /** The tooltip for the icon, displayed on hover. */
    title: string;

    /** Optional CSS class name applied to the icon container. */
    className?: string;
}

const icons: Record<E2ePadlockIcon, JSX.Element> = {
    [E2ePadlockIcon.Normal]: <InfoIcon />,
    [E2ePadlockIcon.Warning]: <ErrorSolidIcon />,
    [E2ePadlockIcon.DecryptionFailure]: <ErrorSolidIcon />,
};

const iconClasses: Record<E2ePadlockIcon, string> = {
    [E2ePadlockIcon.Normal]: styles.normal,
    [E2ePadlockIcon.Warning]: styles.warning,
    [E2ePadlockIcon.DecryptionFailure]: styles.decryptionFailure,
};

/**
 * A small icon with tooltip, used in the left margin of an event tile to
 * indicate a problem with an encrypted event.
 *
 * The icon is rendered with `data-testid="e2e-padlock"`.
 */
export function E2ePadlock({ icon, title, className }: Readonly<E2ePadlockProps>): JSX.Element {
    // We specify isTriggerInteractive=true and make the div interactive manually as a workaround for
    // https://github.com/element-hq/compound/issues/294
    return (
        <Tooltip label={title} isTriggerInteractive={true}>
            <div
                data-testid="e2e-padlock"
                className={classNames(styles.e2ePadlock, iconClasses[icon], className)}
                role="img"
                tabIndex={0}
                aria-label={_t("timeline|e2e_state")}
            >
                {icons[icon]}
            </div>
        </Tooltip>
    );
}
