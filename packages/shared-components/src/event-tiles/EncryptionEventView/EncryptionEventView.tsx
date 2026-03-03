/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { LockSolidIcon, ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./EncryptionEventView.module.css";
import { useI18n } from "../../utils/i18nContext";
import { EventTileBubble } from "../EventTileBubble";

export enum EncryptionEventState {
    /** Encryption settings changed while encryption stayed enabled. */
    CHANGED = "CHANGED",
    /** Someone attempted to disable encryption in an encrypted room. */
    DISABLE_ATTEMPT = "DISABLE_ATTEMPT",
    /** Encryption was enabled in a regular room. */
    ENABLED = "ENABLED",
    /** Encryption was enabled in a DM room. */
    ENABLED_DM = "ENABLED_DM",
    /** Encryption was enabled in a local room. */
    ENABLED_LOCAL = "ENABLED_LOCAL",
    /** Encryption is unavailable/unsupported for this event context. */
    UNSUPPORTED = "UNSUPPORTED",
}

export type EncryptionEventViewSnapshot = {
    /** Which encryption event variant to render. */
    state: EncryptionEventState;
    /** Whether state-event encryption messaging should be shown. */
    encryptedStateEvents?: boolean;
    /** Display name for DM partner, used by ENABLED_DM subtitle text. */
    userName?: string;
    /** Optional CSS classes passed through to EventTileBubble. */
    className?: string;
    /** Optional timestamp element rendered in the EventTileBubble footer slot. */
    timestamp?: JSX.Element;
};

/**
 * ViewModel contract consumed by {@link EncryptionEventView}.
 */
export type EncryptionEventViewModel = ViewModel<EncryptionEventViewSnapshot>;

export interface EncryptionEventViewProps {
    /**
     * ViewModel providing the current encryption event snapshot.
     */
    vm: ViewModel<EncryptionEventViewSnapshot>;
    /**
     * Ref forwarded to the root DOM element.
     */
    ref?: React.RefObject<HTMLDivElement>;
}

export function EncryptionEventView({ vm, ref }: Readonly<EncryptionEventViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { state, encryptedStateEvents, userName, className, timestamp } = useViewModel(vm);

    let icon = <LockSolidIcon />;
    let title = encryptedStateEvents ? _t("common|state_encryption_enabled") : _t("common|encryption_enabled");
    let subtitle = "";

    switch (state) {
        case EncryptionEventState.CHANGED:
            subtitle = _t("timeline|m.room.encryption|parameters_changed");
            break;
        case EncryptionEventState.DISABLE_ATTEMPT:
            title = _t("common|encryption_enabled");
            subtitle = _t("timeline|m.room.encryption|disable_attempt");
            break;
        case EncryptionEventState.ENABLED:
            subtitle = encryptedStateEvents
                ? _t("timeline|m.room.encryption|state_enabled")
                : _t("timeline|m.room.encryption|enabled");
            break;
        case EncryptionEventState.ENABLED_DM:
            subtitle = _t("timeline|m.room.encryption|enabled_dm", { displayName: userName });
            break;
        case EncryptionEventState.ENABLED_LOCAL:
            subtitle = _t("timeline|m.room.encryption|enabled_local");
            break;
        case EncryptionEventState.UNSUPPORTED:
        default:
            icon = <ErrorSolidIcon className={styles.error} />;
            title = _t("timeline|m.room.encryption|disabled");
            subtitle = _t("timeline|m.room.encryption|unsupported");
            break;
    }

    return (
        <EventTileBubble icon={icon} className={className} title={title} subtitle={subtitle} ref={ref}>
            {timestamp}
        </EventTileBubble>
    );
}
