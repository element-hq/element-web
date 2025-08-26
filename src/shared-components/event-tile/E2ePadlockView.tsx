/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Tooltip } from "@vector-im/compound-web";

import { useViewModel } from "../useViewModel";
import type { ViewModel } from "../ViewModel";
import { _t } from "../../languageHandler";

interface E2ePadlockViewSnapshotWithShield {
    noShield?: false;
    iconType: E2ePadlockIconType;
    message: string;
}
interface E2ePadlockViewSnapshotNoShield {
    noShield: true;
}
export type E2ePadlockViewSnapshot = E2ePadlockViewSnapshotNoShield | E2ePadlockViewSnapshotWithShield;

export enum E2ePadlockIconType {
    /** grey shield */
    Normal = "normal",

    /** red shield with (!) */
    Warning = "warning",

    /** key in grey circle */
    DecryptionFailure = "decryption_failure",
}

interface Props {
    vm: ViewModel<E2ePadlockViewSnapshot>;
}

/**
 * This is the padlock icon that is rendered before the encrypted message.
 */
export const E2EPadlockView: React.FC<Props> = ({ vm }) => {
    const vs = useViewModel(vm);
    if (vs.noShield) return null;

    const { iconType: icon, message: title } = vs;
    const classes = `mx_EventTile_e2eIcon mx_EventTile_e2eIcon_${icon}`;
    // We specify isTriggerInteractive=true and make the div interactive manually as a workaround for
    // https://github.com/element-hq/compound/issues/294
    return (
        <Tooltip label={title} isTriggerInteractive={true}>
            <div className={classes} tabIndex={0} aria-label={_t("timeline|e2e_state")} />
        </Tooltip>
    );
};
