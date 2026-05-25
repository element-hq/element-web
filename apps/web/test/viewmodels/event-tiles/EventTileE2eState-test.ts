/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode, EventShieldColour, EventShieldReason } from "matrix-js-sdk/src/crypto-api";

import { mkEvent } from "../../test-utils";
import {
    getEventTileE2ePadlockState,
    type EventTileE2ePadlockStateInput,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileE2eState";

const roomId = "!room:example.org";
const userId = "@alice:example.org";

function makeEvent(): MatrixEvent {
    return mkEvent({
        event: true,
        type: EventType.RoomMessage,
        room: roomId,
        user: userId,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
    });
}

function makeInput(overrides: Partial<EventTileE2ePadlockStateInput> = {}): EventTileE2ePadlockStateInput {
    const mxEvent = overrides.mxEvent ?? makeEvent();

    return {
        mxEvent,
        verificationEvent: overrides.verificationEvent ?? mxEvent,
        shieldColour: EventShieldColour.NONE,
        shieldReason: null,
        isRoomEncrypted: false,
        isLocalRoom: false,
        ...overrides,
    };
}

function mockDecryptionFailure(mxEvent: MatrixEvent, reason: DecryptionFailureCode): void {
    jest.spyOn(mxEvent, "isDecryptionFailure").mockReturnValue(true);
    Object.defineProperty(mxEvent, "decryptionFailureReason", {
        configurable: true,
        value: reason,
    });
}

describe("EventTileE2eState", () => {
    it("does not show a padlock for local rooms", () => {
        const state = getEventTileE2ePadlockState(makeInput({ isLocalRoom: true }));

        expect(state.kind).toBe("none");
    });

    it("shows a decryption failure padlock for generic decryption failures", () => {
        const mxEvent = makeEvent();
        mockDecryptionFailure(mxEvent, DecryptionFailureCode.UNKNOWN_ERROR);

        const state = getEventTileE2ePadlockState(makeInput({ mxEvent }));

        expect(state.kind).toBe("decryptionFailure");
    });

    it("uses the verification event for edited event padlock decisions", () => {
        const mxEvent = makeEvent();
        const verificationEvent = makeEvent();
        mockDecryptionFailure(verificationEvent, DecryptionFailureCode.UNKNOWN_ERROR);

        const state = getEventTileE2ePadlockState(makeInput({ mxEvent, verificationEvent }));

        expect(state.kind).toBe("decryptionFailure");
    });

    it.each([DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED, DecryptionFailureCode.UNSIGNED_SENDER_DEVICE])(
        "does not show a padlock for %s decryption failures",
        (reason) => {
            const mxEvent = makeEvent();
            mockDecryptionFailure(mxEvent, reason);

            const state = getEventTileE2ePadlockState(makeInput({ mxEvent }));

            expect(state.kind).toBe("none");
        },
    );

    it("shows a message-shared state when the authenticity warning has a key forwarding user", () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "getKeyForwardingUser").mockReturnValue("@bob:example.org");

        const state = getEventTileE2ePadlockState(
            makeInput({
                mxEvent,
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
            }),
        );

        expect(state).toEqual({
            kind: "messageShared",
            keyForwardingUserId: "@bob:example.org",
            roomId,
        });
    });

    it("shows a normal shield for grey shield state", () => {
        const state = getEventTileE2ePadlockState(
            makeInput({
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            }),
        );

        expect(state).toEqual({
            kind: "shield",
            shieldColour: EventShieldColour.GREY,
            shieldReason: EventShieldReason.UNSIGNED_DEVICE,
        });
    });

    it("shows a warning shield for red shield state", () => {
        const state = getEventTileE2ePadlockState(
            makeInput({
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNKNOWN_DEVICE,
            }),
        );

        expect(state).toEqual({
            kind: "shield",
            shieldColour: EventShieldColour.RED,
            shieldReason: EventShieldReason.UNKNOWN_DEVICE,
        });
    });

    it("shows an unencrypted warning for unencrypted events in encrypted rooms", () => {
        const state = getEventTileE2ePadlockState(makeInput({ isRoomEncrypted: true }));

        expect(state.kind).toBe("unencrypted");
    });

    it.each([EventStatus.ENCRYPTING, EventStatus.NOT_SENT])(
        "does not show an unencrypted warning for %s local echo state",
        (status) => {
            const mxEvent = makeEvent();
            mxEvent.status = status;

            const state = getEventTileE2ePadlockState(makeInput({ mxEvent, isRoomEncrypted: true }));

            expect(state.kind).toBe("none");
        },
    );

    it("does not show an unencrypted warning for state events in encrypted rooms", () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isState").mockReturnValue(true);

        const state = getEventTileE2ePadlockState(makeInput({ mxEvent, isRoomEncrypted: true }));

        expect(state.kind).toBe("none");
    });

    it("does not show an unencrypted warning for redacted events in encrypted rooms", () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isRedacted").mockReturnValue(true);

        const state = getEventTileE2ePadlockState(makeInput({ mxEvent, isRoomEncrypted: true }));

        expect(state.kind).toBe("none");
    });

    it("does not show an unencrypted warning for encrypted events", () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);

        const state = getEventTileE2ePadlockState(makeInput({ mxEvent, isRoomEncrypted: true }));

        expect(state.kind).toBe("none");
    });
});
