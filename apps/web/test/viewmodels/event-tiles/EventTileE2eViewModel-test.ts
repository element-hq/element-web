/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor } from "@testing-library/dom";
import { EventType, MatrixEventEvent, type MatrixClient, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import {
    CryptoEvent,
    type EventEncryptionInfo,
    EventShieldColour,
    EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import { E2ePadlockIcon } from "@element-hq/web-shared-components";

import { mkEvent, MockClientWithEventEmitter } from "../../test-utils";
import { EventTileE2eViewModel } from "../../../src/viewmodels/room/timeline/event-tile/EventTileE2eViewModel";

function makeClient(
    getEncryptionInfoForEvent = jest.fn<Promise<EventEncryptionInfo | null>, [MatrixEvent]>(),
): MockClientWithEventEmitter & MatrixClient {
    return new MockClientWithEventEmitter({
        getCrypto: jest.fn(() => ({
            getEncryptionInfoForEvent,
        })),
    }) as MockClientWithEventEmitter & MatrixClient;
}

describe("EventTileE2eViewModel", () => {
    const roomId = "!room:example.org";
    const userId = "@alice:example.org";
    let viewModels: EventTileE2eViewModel[];

    beforeEach(() => {
        viewModels = [];
    });

    afterEach(() => {
        for (const vm of viewModels) {
            vm.dispose();
        }
    });

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

    function makeViewModel(props: ConstructorParameters<typeof EventTileE2eViewModel>[0]): EventTileE2eViewModel {
        const vm = new EventTileE2eViewModel(props);
        viewModels.push(vm);
        return vm;
    }

    it("verifies encrypted events on start", async () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);
        const cli = makeClient(
            jest.fn().mockResolvedValue({
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo),
        );

        const vm = makeViewModel({
            cli,
            mxEvent,
            isRoomEncrypted: false,
            enableListeners: true,
        });
        vm.start();

        await waitFor(() =>
            expect(vm.getSnapshot()).toEqual({
                kind: "icon",
                icon: E2ePadlockIcon.Normal,
                title: "Encrypted by a device not verified by its owner.",
            }),
        );
    });

    it("re-verifies when the sender verification changes", async () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);
        const cli = makeClient(
            jest
                .fn()
                .mockResolvedValueOnce({
                    shieldColour: EventShieldColour.GREY,
                    shieldReason: EventShieldReason.UNSIGNED_DEVICE,
                } as EventEncryptionInfo)
                .mockResolvedValueOnce({
                    shieldColour: EventShieldColour.RED,
                    shieldReason: EventShieldReason.UNKNOWN_DEVICE,
                } as EventEncryptionInfo),
        );

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: true,
        });
        vm.start();
        await waitFor(() => expect(vm.getSnapshot().kind).toBe("icon"));

        cli.emit(CryptoEvent.UserTrustStatusChanged, userId, {});

        await waitFor(() =>
            expect(vm.getSnapshot()).toEqual({
                kind: "icon",
                icon: E2ePadlockIcon.Warning,
                title: "Encrypted by an unknown or deleted device.",
            }),
        );
    });

    it("uses the replacing event for verification after edits", async () => {
        const mxEvent = makeEvent();
        const replacementEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);
        jest.spyOn(replacementEvent, "isEncrypted").mockReturnValue(true);
        const getEncryptionInfoForEvent = jest.fn(async (event: MatrixEvent) => {
            return {
                shieldColour: event === replacementEvent ? EventShieldColour.RED : EventShieldColour.NONE,
                shieldReason: event === replacementEvent ? EventShieldReason.UNKNOWN_DEVICE : null,
            } as EventEncryptionInfo;
        });
        const cli = makeClient(getEncryptionInfoForEvent);

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: true,
        });
        vm.start();
        await waitFor(() => expect(vm.getSnapshot().kind).toBe("none"));

        mxEvent.makeReplaced(replacementEvent);

        await waitFor(() =>
            expect(vm.getSnapshot()).toEqual({
                kind: "icon",
                icon: E2ePadlockIcon.Warning,
                title: "Encrypted by an unknown or deleted device.",
            }),
        );
        expect(getEncryptionInfoForEvent).toHaveBeenLastCalledWith(replacementEvent);
    });

    it("derives the unencrypted warning from room encryption state", () => {
        const vm = makeViewModel({
            cli: makeClient(),
            mxEvent: makeEvent(),
            isRoomEncrypted: true,
            enableListeners: false,
        });

        expect(vm.getSnapshot()).toEqual({
            kind: "icon",
            icon: E2ePadlockIcon.Warning,
            title: "Not encrypted",
        });
    });

    it("removes registered listeners on dispose", () => {
        const mxEvent = makeEvent();
        const cli = makeClient();

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: true,
        });
        vm.start();

        expect(cli.listenerCount(CryptoEvent.UserTrustStatusChanged)).toBe(1);
        expect(mxEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(1);
        expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(1);

        vm.dispose();

        expect(cli.listenerCount(CryptoEvent.UserTrustStatusChanged)).toBe(0);
        expect(mxEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(0);
        expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(0);
    });

    it("moves event listeners when the event prop changes", () => {
        const oldEvent = makeEvent();
        const newEvent = makeEvent();
        const cli = makeClient();

        const vm = makeViewModel({
            cli,
            mxEvent: oldEvent,
            enableListeners: true,
        });
        vm.start();

        vm.setProps({ mxEvent: newEvent });

        expect(oldEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(0);
        expect(oldEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(0);
        expect(newEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(1);
        expect(newEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(1);
        expect(cli.listenerCount(CryptoEvent.UserTrustStatusChanged)).toBe(1);
    });

    it("does not register live listeners when disabled", () => {
        const mxEvent = makeEvent();
        const cli = makeClient();

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: false,
        });
        vm.start();

        expect(cli.listenerCount(CryptoEvent.UserTrustStatusChanged)).toBe(0);
        expect(mxEvent.listenerCount(MatrixEventEvent.Decrypted)).toBe(0);
        expect(mxEvent.listenerCount(MatrixEventEvent.Replaced)).toBe(0);
    });

    it("does not re-verify when a different user's verification changes", async () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);
        const getEncryptionInfoForEvent = jest.fn().mockResolvedValue({
            shieldColour: EventShieldColour.GREY,
            shieldReason: EventShieldReason.UNSIGNED_DEVICE,
        } as EventEncryptionInfo);
        const cli = makeClient(getEncryptionInfoForEvent);

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: true,
        });
        vm.start();
        await waitFor(() => expect(getEncryptionInfoForEvent).toHaveBeenCalledTimes(1));

        cli.emit(CryptoEvent.UserTrustStatusChanged, "@bob:example.org", {});

        expect(getEncryptionInfoForEvent).toHaveBeenCalledTimes(1);
    });

    it("ignores stale async verification results", async () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "isEncrypted").mockReturnValue(true);

        let resolveFirst: (value: EventEncryptionInfo) => void;
        const firstResult = new Promise<EventEncryptionInfo>((resolve) => {
            resolveFirst = resolve;
        });
        const getEncryptionInfoForEvent = jest
            .fn()
            .mockReturnValueOnce(firstResult)
            .mockResolvedValueOnce({
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNKNOWN_DEVICE,
            } as EventEncryptionInfo);
        const cli = makeClient(getEncryptionInfoForEvent);

        const vm = makeViewModel({
            cli,
            mxEvent,
            enableListeners: true,
        });
        vm.start();
        cli.emit(CryptoEvent.UserTrustStatusChanged, userId, {});

        await waitFor(() =>
            expect(vm.getSnapshot()).toEqual({
                kind: "icon",
                icon: E2ePadlockIcon.Warning,
                title: "Encrypted by an unknown or deleted device.",
            }),
        );

        resolveFirst!({
            shieldColour: EventShieldColour.GREY,
            shieldReason: EventShieldReason.UNSIGNED_DEVICE,
        } as EventEncryptionInfo);

        await Promise.resolve();

        expect(vm.getSnapshot()).toEqual({
            kind: "icon",
            icon: E2ePadlockIcon.Warning,
            title: "Encrypted by an unknown or deleted device.",
        });
    });
});
