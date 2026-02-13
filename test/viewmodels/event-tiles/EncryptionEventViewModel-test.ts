/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { waitFor } from "@testing-library/dom";
import { mocked } from "jest-mock";
import { type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
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

    beforeEach(() => {
        jest.clearAllMocks();
        client = stubClient();
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

    const createVm = (): EncryptionEventViewModel =>
        new EncryptionEventViewModel({
            mxEvent: event,
        });

    it("sets ENABLED for encrypted room", async () => {
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(room);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));
        expect(vm.getSnapshot()).toMatchObject({
            state: EncryptionEventState.ENABLED,
            className: "mx_EventTileBubble mx_cryptoEvent",
            simplified: false,
        });
    });

    it("sets ENABLED with simplified=true for encrypted state events", async () => {
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(room);
        client.enableEncryptedStateEvents = true;
        (event.getContent() as RoomEncryptionEventContent)["io.element.msc4362.encrypt_state_events"] = true;

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.ENABLED));
        expect(vm.getSnapshot().simplified).toBe(true);
    });

    it("sets CHANGED when previous algorithm is already megolm", async () => {
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(room);
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
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(room);
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
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(false);
        mocked(client.getRoom).mockReturnValue(room);

        const vm = createVm();
        await waitFor(() => expect(vm.getSnapshot().state).toBe(EncryptionEventState.UNSUPPORTED));
        expect(vm.getSnapshot().state).toBe(EncryptionEventState.UNSUPPORTED);
        expect(vm.getSnapshot().className).toBe("mx_EventTileBubble mx_cryptoEvent");
    });

    it("sets ENABLED_LOCAL for encrypted local room", async () => {
        const localRoomId = "local+123";
        const localRoom = new LocalRoom(localRoomId, client, client.getUserId()!);
        jest.spyOn(localRoom, "hasEncryptionStateEvent").mockReturnValue(true);
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
        expect(localRoom.hasEncryptionStateEvent).toHaveBeenCalled();
    });

    it("does not emit snapshot updates when content has no diff", async () => {
        const room = client.getRoom(roomId)!;
        mocked(room.hasEncryptionStateEvent).mockReturnValue(true);
        mocked(client.getRoom).mockReturnValue(room);
        event = mkEvent({
            event: true,
            room: roomId,
            user: client.getUserId()!,
            type: "m.room.encryption",
            content: { algorithm },
            prev_content: { algorithm },
        });

        const vm = createVm();
        const cb = jest.fn();
        vm.subscribe(cb);

        event.emit(MatrixEventEvent.SentinelUpdated);

        expect(cb).not.toHaveBeenCalled();
    });
});
