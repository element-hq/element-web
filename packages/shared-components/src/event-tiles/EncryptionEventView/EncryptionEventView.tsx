/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX } from "react";
import { LockSolidIcon, ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./EncryptionEventView.module.css";
import { useI18n } from "../../utils/i18nContext";
import { EventTileBubble } from "../EventTileBubble";

export enum EncryptionState {
    CHANGED = "CHANGED",
    DISABLE_ATTEMPT = "DISABLE_ATTEMPT",
    ENABLED = "ENABLED",
    ENABLED_DM = "ENABLED_DM",
    ENABLED_LOCAL = "ENABLED_LOCAL",
    UNSUPPORTED = "UNSUPPORTED",
}

export type EncryptionEventViewSnapshot = {
    state: EncryptionState;
    simplified?: boolean;
    userName?: string;
    className?: string;
    timestamp?: JSX.Element;
};

/**
 * The view model for the component.
 */
export type EncryptionEventViewModel = ViewModel<EncryptionEventViewSnapshot>;

export interface EncryptionEventViewProps {
    /**
     * The view model for the component.
     */
    vm: ViewModel<EncryptionEventViewSnapshot>;
    /**
     * React ref to attach to any React components returned
     */
    ref?: React.RefObject<any>;
}

export function EncryptionEventView({ vm, ref }: Readonly<EncryptionEventViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { state, simplified, userName, className, timestamp } = useViewModel(vm);

    let icon = <LockSolidIcon />;
    let title = simplified ? _t("common|state_encryption_enabled") : _t("common|encryption_enabled");
    let subtitle = "";

    switch (state) {
        case EncryptionState.CHANGED:
            subtitle = _t("timeline|m.room.encryption|parameters_changed");
            break;
        case EncryptionState.DISABLE_ATTEMPT:
            subtitle = _t("timeline|m.room.encryption|disable_attempt");
            break;
        case EncryptionState.ENABLED:
            subtitle = simplified
                ? _t("timeline|m.room.encryption|state_enabled")
                : _t("timeline|m.room.encryption|enabled");
            break;
        case EncryptionState.ENABLED_DM:
            subtitle = _t("timeline|m.room.encryption|enabled_dm", { displayName: userName });
            break;
        case EncryptionState.ENABLED_LOCAL:
            subtitle = _t("timeline|m.room.encryption|enabled_local");
            break;
        case EncryptionState.UNSUPPORTED:
        default:
            icon = <ErrorSolidIcon className={styles.error} />;
            title = _t("timeline|m.room.encryption|disabled");
            subtitle = _t("timeline|m.room.encryption|unsupported");
            break;
    }

    return (
        <EventTileBubble icon={icon} className={classNames(className)} title={title} subtitle={subtitle} ref={ref}>
            {timestamp}
        </EventTileBubble>
    );
}
