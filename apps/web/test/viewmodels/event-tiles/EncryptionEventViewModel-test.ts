/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { waitFor } from "@testing-library/dom";
import { mocked } from "jest-mock";
import { RoomStateEvent, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { EncryptionEventState } from "@element-hq/web-shared-components";

import type { RoomEncryptionEventContent } from "matrix-js-sdk/src/types";
import { EncryptionEventViewModel } from "../../../src/viewmodels/event-tiles/EncryptionEventViewModel";
import { LocalRoom } from "../../../src/models/LocalRoom";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { mkEvent, stubClient } from "../../test-utils";

describe("EncryptionEventViewModel", () => {
    const roomId = "!room:example.com";
    const algorithm = "m.megolm.v1.aes-sha2";
    let client: MatrixClient;
    let event: MatrixEvent;
    let room: Room;

    beforeEach(() => {
        jest.clearAllMocks();
        client = stubClient();
        room = client.getRoom(roomId)!;
        mocked(client.getRoom).mockReturnValue(room);
        event = mkEvent({
            event: true,
            room: roomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: {
                algorithm,
            },
            prev_content: {},
        });
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);
    });

    const setRoomEncrypted = (encrypted: boolean): void => {
        const crypto = client.getCrypto()!;
        mocked(crypto.isEncryptionEnabledInRoom).mockResolvedValue(encrypted);
    };

    const createVm = (
        props: Partial<ConstructorParameters<typeof EncryptionEventViewModel>[0]> = {},
    ): EncryptionEventViewModel =>
        new EncryptionEventViewModel({
            mxEvent: event,
            cli: client,
            ...props,
        });

    it("sets ENABLED for encrypted room", async () => {
        setRoomEncrypted(true);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));
        expect(vm.getSnapshot()).toMatchObject({
            state: EncryptionEventState.ENABLED,
            className: "mx_EventTileBubble mx_cryptoEvent mx_cryptoEvent_icon",
            encryptedStateEvents: false,
        });
    });

    it("uses synchronous room encryption state for the initial snapshot", () => {
        jest.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(true);
        setRoomEncrypted(false);

        const vm = createVm();
        expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED);
    });

    it("sets ENABLED with encryptedStateEvents=true for encrypted state events", async () => {
        setRoomEncrypted(true);
        client.enableEncryptedStateEvents = true;
        (event.getContent() as RoomEncryptionEventContent)["io.element.msc4362.encrypt_state_events"] = true;

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));
        expect(vm.getSnapshot().encryptedStateEvents).toBe(true);
    });

    it("sets CHANGED when previous algorithm is already megolm", async () => {
        setRoomEncrypted(true);
        event = mkEvent({
            event: true,
            room: roomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: {
                algorithm,
                rotation_period_ms: 1,
            },
            prev_content: { algorithm },
        });

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.CHANGED));
    });

    it("sets DISABLE_ATTEMPT for unknown algorithm in encrypted room", async () => {
        setRoomEncrypted(true);
        event = mkEvent({
            event: true,
            room: roomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: { algorithm: "unknown" },
            prev_content: {},
        });

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.DISABLE_ATTEMPT));
    });

    it("sets UNSUPPORTED for unencrypted room", async () => {
        setRoomEncrypted(false);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.UNSUPPORTED));
        expect(vm.getSnapshot().className).toBe("mx_EventTileBubble mx_cryptoEvent");
    });

    it("sets ENABLED_DM with partner display name", async () => {
        setRoomEncrypted(true);
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn().mockReturnValue("@alice:example.com"),
        } as unknown as DMRoomMap);
        mocked(room.getMember).mockReturnValue({
            rawDisplayName: "Alice",
        } as unknown as ReturnType<typeof room.getMember>);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED_DM));
        expect(vm.getSnapshot().userName).toBe("Alice");
    });

    it("sets ENABLED_LOCAL for encrypted local room", async () => {
        const localRoomId = "local+123";
        const localRoom = new LocalRoom(localRoomId, client, client.getUserId()!);
        jest.spyOn(localRoom, "isEncryptionEnabled").mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(localRoom);
        event = mkEvent({
            event: true,
            room: localRoomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: { algorithm },
            prev_content: {},
        });
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED_LOCAL));
        expect(localRoom.isEncryptionEnabled).toHaveBeenCalled();
    });

    it("recomputes snapshot on RoomStateEvent.Update", async () => {
        setRoomEncrypted(false);
        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.UNSUPPORTED));

        setRoomEncrypted(true);
        room.emit(RoomStateEvent.Update, room.currentState);

        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));
    });

    it("does not emit updates when snapshot is unchanged", async () => {
        setRoomEncrypted(true);
        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));

        const listener = jest.fn();
        const unsubscribe = vm.subscribe(listener);

        room.emit(RoomStateEvent.Update, room.currentState);

        await waitFor(() => expect(mocked(client.getCrypto()!.isEncryptionEnabledInRoom)).toHaveBeenCalledTimes(2));
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });
});
