/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode, EventShieldColour, EventShieldReason } from "matrix-js-sdk/src/crypto-api";

import { E2ePadlockIconType, type E2ePadlockViewSnapshot } from "../../shared-components/event-tile/E2ePadlockView";
import { BaseViewModel } from "../base/BaseViewModel";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { _t } from "../../languageHandler";

interface Props {
    event: MatrixEvent;
    cli: MatrixClient;
    isRoomEncrypted: boolean;
}

/**
 * View-model for the padlock icon rendered before encrypted message.
 */
export class E2ePadlockViewModel extends BaseViewModel<E2ePadlockViewSnapshot, Props> {
    public constructor(props: Props) {
        super(props, { noShield: true });
    }

    /**
     * Calculates the icon and message to show by verifying the encryption
     * info of the associated event.
     */
    public async verifyEvent(): Promise<void> {
        const [colour, reason] = await this.getShieldInfo();
        const newSnapshot = this.getIconAndMessage(colour, reason);
        this.snapshot.set(newSnapshot);
    }

    private async getShieldInfo(): Promise<[EventShieldColour, EventShieldReason | null]> {
        const { event, cli } = this.props;
        // if the event was edited, show the verification info for the edit, not
        // the original
        const mxEvent = event.replacingEvent() ?? event;

        if (!mxEvent.isEncrypted() || mxEvent.isRedacted()) {
            return [EventShieldColour.NONE, null];
        }

        const encryptionInfo = (await cli.getCrypto()?.getEncryptionInfoForEvent(mxEvent)) ?? null;
        if (encryptionInfo === null) {
            // likely a decryption error
            return [EventShieldColour.NONE, null];
        }

        return [encryptionInfo.shieldColour, encryptionInfo.shieldReason];
    }

    /**
     * Convert EventShieldReason to a user readable message.
     */
    private getShieldMessage(reason: EventShieldReason | null): string {
        switch (reason) {
            case EventShieldReason.UNVERIFIED_IDENTITY:
                return _t("encryption|event_shield_reason_unverified_identity");

            case EventShieldReason.UNSIGNED_DEVICE:
                return _t("encryption|event_shield_reason_unsigned_device");

            case EventShieldReason.UNKNOWN_DEVICE:
                return _t("encryption|event_shield_reason_unknown_device");

            case EventShieldReason.AUTHENTICITY_NOT_GUARANTEED:
                return _t("encryption|event_shield_reason_authenticity_not_guaranteed");

            case EventShieldReason.MISMATCHED_SENDER_KEY:
                return _t("encryption|event_shield_reason_mismatched_sender_key");

            case EventShieldReason.SENT_IN_CLEAR:
                return _t("common|unencrypted");

            case EventShieldReason.VERIFICATION_VIOLATION:
                return _t("timeline|decryption_failure|sender_identity_previously_verified");

            default:
                return _t("error|unknown");
        }
    }

    /**
     * Some events are expected to be unencrypted even in an encrypted room.
     * Checks if this is such an event.
     */
    private isEventAllowedToBeUnencrypted(event: MatrixEvent): boolean {
        // event is being encrypted or is not_sent (Unknown Devices/Network Error)
        if (event.status === EventStatus.ENCRYPTING) {
            return true;
        }
        if (event.status === EventStatus.NOT_SENT) {
            return true;
        }
        if (event.isState()) {
            return true; // we expect this to be unencrypted
        }
        if (event.isRedacted()) {
            return true; // we expect this to be unencrypted
        }
        return false;
    }

    private getIconAndMessage(
        shieldColour: EventShieldColour,
        shieldReason: EventShieldReason | null,
    ): E2ePadlockViewSnapshot {
        const { isRoomEncrypted } = this.props;
        const event = this.props.event.replacingEvent() ?? this.props.event;

        if (isLocalRoom(event.getRoomId()!)) {
            // no icon for local rooms
            return { noShield: true };
        }

        // event could not be decrypted
        if (event.isDecryptionFailure()) {
            switch (event.decryptionFailureReason) {
                // These two errors get icons from DecryptionFailureBody, so we hide the padlock icon
                case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                    return { noShield: true };
                default:
                    return {
                        message: _t("timeline|undecryptable_tooltip"),
                        iconType: E2ePadlockIconType.DecryptionFailure,
                    };
            }
        }

        if (shieldColour !== EventShieldColour.NONE) {
            const message = this.getShieldMessage(shieldReason);
            const iconType =
                shieldColour === EventShieldColour.GREY ? E2ePadlockIconType.Normal : E2ePadlockIconType.Warning;
            return { message, iconType };
        }

        if (isRoomEncrypted && !event.isEncrypted() && !this.isEventAllowedToBeUnencrypted(event)) {
            // if the event is not encrypted, but it's an e2e room, show a warning
            return { message: _t("common|unencrypted"), iconType: E2ePadlockIconType.Warning };
        }

        return {
            noShield: true,
        };
    }
}
