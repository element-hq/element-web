/*
Copyright 2025 Vector Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { ErrorSolidIcon, InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler.tsx";

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

interface IE2ePadlockProps {
    /** The icon to display. */
    icon: E2ePadlockIcon;

    /** The tooltip for the icon, displayed on hover. */
    title: string;
}

const icons = {
    [E2ePadlockIcon.Normal]: <InfoIcon color="var(--cpd-color-icon-tertiary)" />,
    [E2ePadlockIcon.Warning]: <ErrorSolidIcon color="var(--cpd-color-icon-critical-primary)" />,
    [E2ePadlockIcon.DecryptionFailure]: <ErrorSolidIcon color="var(--cpd-color-icon-tertiary)" />,
};

/**
 * A small icon with tooltip, used in the left margin of an {@link EventTile}, which indicates a problem
 * with an encrypted event.
 *
 * The icon is rendered with `data-testid="e2e-padlock"`.
 */
export function E2ePadlock(props: IE2ePadlockProps): ReactNode {
    // We specify isTriggerInteractive=true and make the div interactive manually as a workaround for
    // https://github.com/element-hq/compound/issues/294
    return (
        <Tooltip label={props.title} isTriggerInteractive={true}>
            <div
                data-testid="e2e-padlock"
                className="mx_EventTile_e2eIcon"
                tabIndex={0}
                aria-label={_t("timeline|e2e_state")}
            >
                {icons[props.icon]}
            </div>
        </Tooltip>
    );
}
