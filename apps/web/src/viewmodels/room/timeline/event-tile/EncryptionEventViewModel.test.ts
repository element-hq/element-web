/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { waitFor } from "@testing-library/dom";
import { RoomStateEvent, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { EncryptionEventState } from "@element-hq/web-shared-components";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { mkEvent, stubClient } from "test-utils";

import type { RoomEncryptionEventContent } from "matrix-js-sdk/src/types";
import { EncryptionEventViewModel } from "./EncryptionEventViewModel";
import { LocalRoom } from "../../../../models/LocalRoom";
import DMRoomMap from "../../../../utils/DMRoomMap";

describe("EncryptionEventViewModel", () => {
    const roomId = "!room:example.com";
    const algorithm = "m.megolm.v1.aes-sha2";
    let client: MatrixClient;
    let event: MatrixEvent;
    let room: Room;

    beforeEach(() => {
        vi.clearAllMocks();
        client = stubClient();
        room = client.getRoom(roomId)!;
        vi.mocked(client.getRoom).mockReturnValue(room);
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
        vi.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap);
    });

    const setRoomEncrypted = (encrypted: boolean): void => {
        const crypto = client.getCrypto()!;
        vi.mocked(crypto.isEncryptionEnabledInRoom).mockResolvedValue(encrypted);
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
            encryptedStateEvents: false,
        });
    });

    it("uses synchronous room encryption state for the initial snapshot", () => {
        vi.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(true);
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
    });

    it("sets ENABLED_DM with partner display name", async () => {
        setRoomEncrypted(true);
        vi.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: vi.fn().mockReturnValue("@alice:example.com"),
        } as unknown as DMRoomMap);
        vi.mocked(room.getMember).mockReturnValue({
            rawDisplayName: "Alice",
        } as unknown as ReturnType<typeof room.getMember>);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED_DM));
        expect(vm.getSnapshot().userName).toBe("Alice");
    });

    it("sets ENABLED_LOCAL for encrypted local room", async () => {
        const localRoomId = "local+123";
        const localRoom = new LocalRoom(localRoomId, client, client.getUserId()!);
        vi.spyOn(localRoom, "isEncryptionEnabled").mockReturnValue(true);
        vi.mocked(client.getRoom).mockReturnValue(localRoom);
        event = mkEvent({
            event: true,
            room: localRoomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: { algorithm },
            prev_content: {},
        });
        vi.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: vi.fn(),
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

        const listener = vi.fn();
        const unsubscribe = vm.subscribe(listener);

        room.emit(RoomStateEvent.Update, room.currentState);

        await waitFor(() => expect(vi.mocked(client.getCrypto()!.isEncryptionEnabledInRoom)).toHaveBeenCalledTimes(2));
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });
});
