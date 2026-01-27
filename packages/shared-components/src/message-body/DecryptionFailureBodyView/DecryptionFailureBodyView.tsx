/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX } from "react";
import { BlockIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { type I18nApi } from "@element-hq/element-web-module-api";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import styles from "./DecryptionFailureBodyView.module.css";
import { useI18n } from "../../utils/i18nContext";

/**
 * A reason code for a failure to decrypt an event.
 */
export enum DecryptionFailureReason {
    /** A special case of {@link MEGOLM_KEY_WITHHELD}: the sender has told us it is withholding the key, because the current device is unverified. */
    MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE = "MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE",

    /**
     * Message was sent before the current device was created; there is no key backup on the server, so this
     * decryption failure is expected.
     */
    HISTORICAL_MESSAGE_NO_KEY_BACKUP = "HISTORICAL_MESSAGE_NO_KEY_BACKUP",

    /**
     * Message was sent before the current device was created; there was a key backup on the server, but we don't
     * seem to have access to the backup. (Probably we don't have the right key.)
     */
    HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED = "HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED",

    /**
     * Message was sent when the user was not a member of the room.
     */
    HISTORICAL_MESSAGE_USER_NOT_JOINED = "HISTORICAL_MESSAGE_USER_NOT_JOINED",

    /**
     * The sender's identity is not verified, but was previously verified.
     */
    SENDER_IDENTITY_PREVIOUSLY_VERIFIED = "SENDER_IDENTITY_PREVIOUSLY_VERIFIED",

    /**
     * The sender device is not cross-signed. This will only be used if the
     * device isolation mode is set to `OnlySignedDevicesIsolationMode`.
     */
    UNSIGNED_SENDER_DEVICE = "UNSIGNED_SENDER_DEVICE",

    /**
     * Default message for decryption failures.
     */
    UNABLE_TO_DECRYPT = "UNABLE_TO_DECRYPT",
}

export interface DecryptionFailureBodyViewSnapshot {
    /**
     * The decryption failure reason of the event.
     */
    decryptionFailureReason: DecryptionFailureReason;
    /**
     * The local device verification state.
     */
    isLocalDeviceVerified?: boolean;
    /**
     * Extra CSS classes to apply to the component
     */
    extraClassNames?: string[];
}

/**
 * The view model for the component.
 */
export type DecryptionFailureBodyViewModel = ViewModel<DecryptionFailureBodyViewSnapshot>;

interface DecryptionFailureBodyViewProps {
    /**
     * The view model for the component.
     */
    vm: DecryptionFailureBodyViewModel;
    /**
     * React ref to attach to any React components returned
     */
    ref?: React.RefObject<any>;
}

/**
 * Resolve the localized error message for a decryption failure reason.
 *
 * @param i18nApi - I18n API used to translate message keys.
 * @param decryptionFailureReason - Reason code for the decryption failure.
 * @param isLocalDeviceVerified - Whether the local device is verified, used for certain historical cases.
 */
function getErrorMessage(
    i18nApi: I18nApi,
    decryptionFailureReason: DecryptionFailureReason,
    isLocalDeviceVerified?: boolean,
): string | JSX.Element {
    const _t = i18nApi.translate;

    switch (decryptionFailureReason) {
        case DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
            return _t("timeline|decryption_failure|blocked");

        case DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
            return _t("timeline|decryption_failure|historical_event_no_key_backup");

        case DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
            if (isLocalDeviceVerified === false) {
                // The user seems to have a key backup, so prompt them to verify in the hope that doing so will
                // mean we can restore from backup and we'll get the key for this message.
                return _t("timeline|decryption_failure|historical_event_unverified_device");
            }
            // otherwise, use the default.
            break;

        case DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED:
            // TODO: event should be hidden instead of showing this error.
            //   To be revisited as part of https://github.com/element-hq/element-meta/issues/2449
            return _t("timeline|decryption_failure|historical_event_user_not_joined");

        case DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            return (
                <span>
                    <BlockIcon className={styles.icon} width="16px" height="16px" />
                    {_t("timeline|decryption_failure|sender_identity_previously_verified")}
                </span>
            );

        case DecryptionFailureReason.UNSIGNED_SENDER_DEVICE:
            // TODO: event should be hidden instead of showing this error.
            //   To be revisited as part of https://github.com/element-hq/element-meta/issues/2449
            return (
                <span>
                    <BlockIcon className={styles.icon} width="16px" height="16px" />
                    {_t("timeline|decryption_failure|sender_unsigned_device")}
                </span>
            );
    }
    return _t("timeline|decryption_failure|unable_to_decrypt");
}

/**
 * Get the extra CSS class for the given decryption failure reason, when one applies.
 */
function errorClassName(decryptionFailureReason: DecryptionFailureReason): string | null {
    switch (decryptionFailureReason) {
        case DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
        case DecryptionFailureReason.UNSIGNED_SENDER_DEVICE:
            return styles.error;
    }
    return null;
}

/**
 * A placeholder element for messages that could not be decrypted
 *
 * @example
 * ```tsx
 * <DecryptionFailureBodyView vm={DecryptionFailureBodyViewModel} />
 * ```
 */
export function DecryptionFailureBodyView({ vm, ref }: Readonly<DecryptionFailureBodyViewProps>): JSX.Element {
    const i18nApi = useI18n();
    const { decryptionFailureReason, isLocalDeviceVerified, extraClassNames } = useViewModel(vm);
    const classes = classNames(styles.content, errorClassName(decryptionFailureReason), extraClassNames);

    return (
        <div className={classes} ref={ref}>
            {getErrorMessage(i18nApi, decryptionFailureReason, isLocalDeviceVerified)}
        </div>
    );
}
