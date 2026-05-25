/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode, EventShieldColour, EventShieldReason } from "matrix-js-sdk/src/crypto-api";

/** Display state for the EventTile E2E padlock area. */
export type EventTileE2ePadlockState =
    | {
          /** No E2E padlock should render. */
          kind: "none";
      }
    | {
          /** Render the undecryptable padlock. */
          kind: "decryptionFailure";
      }
    | {
          /** Render the forwarded/shared message indicator. */
          kind: "messageShared";
          /** User ID that forwarded the message key. */
          keyForwardingUserId: string;
          /** Room ID used by the shared-message indicator. */
          roomId: string;
      }
    | {
          /** Render a trust shield padlock. */
          kind: "shield";
          /** Shield colour used to choose the rendered icon. */
          shieldColour: EventShieldColour;
          /** Shield reason used to choose the visible tooltip. */
          shieldReason: EventShieldReason | null;
      }
    | {
          /** Render the unencrypted warning in an encrypted room. */
          kind: "unencrypted";
      };

/** Inputs for deriving EventTile E2E padlock display state. */
export interface EventTileE2ePadlockStateInput {
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Event used for verification decisions, usually the replacing event for edits. */
    verificationEvent: MatrixEvent;
    /** Current event shield colour. */
    shieldColour: EventShieldColour;
    /** Current event shield reason. */
    shieldReason: EventShieldReason | null;
    /** Whether the room is encrypted. */
    isRoomEncrypted?: boolean | null;
    /** Whether the event belongs to a local room. */
    isLocalRoom: boolean;
}

/** Derives the E2E padlock display state for EventTile. */
export function getEventTileE2ePadlockState({
    mxEvent,
    verificationEvent,
    shieldColour,
    shieldReason,
    isRoomEncrypted,
    isLocalRoom,
}: EventTileE2ePadlockStateInput): EventTileE2ePadlockState {
    if (isLocalRoom) {
        return { kind: "none" };
    }

    if (verificationEvent.isDecryptionFailure()) {
        switch (verificationEvent.decryptionFailureReason) {
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                return { kind: "none" };
            default:
                return { kind: "decryptionFailure" };
        }
    }

    if (shieldReason === EventShieldReason.AUTHENTICITY_NOT_GUARANTEED) {
        const keyForwardingUserId = mxEvent.getKeyForwardingUser();
        if (keyForwardingUserId) {
            return {
                kind: "messageShared",
                keyForwardingUserId,
                roomId: verificationEvent.getRoomId()!,
            };
        }
    }

    if (shieldColour !== EventShieldColour.NONE) {
        return {
            kind: "shield",
            shieldColour,
            shieldReason,
        };
    }

    if (isRoomEncrypted) {
        if (
            verificationEvent.status === EventStatus.ENCRYPTING ||
            verificationEvent.status === EventStatus.NOT_SENT ||
            verificationEvent.isState() ||
            verificationEvent.isRedacted()
        ) {
            return { kind: "none" };
        }

        if (!verificationEvent.isEncrypted()) {
            return { kind: "unencrypted" };
        }
    }

    return { kind: "none" };
}
