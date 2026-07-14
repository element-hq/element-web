/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { mkRoom, resetAsyncStoreWithClient, setupAsyncStoreWithClient, stubClient } from "test-utils/test-utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import defaultDispatcher from "../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import { leaveRoomBehaviour } from "./leave-behaviour";
import { SDKContextClass } from "../contexts/SDKContextClass";
import DMRoomMap from "../utils/DMRoomMap";
import { MetaSpace } from "../stores/spaces";
import { type ActionPayload } from "../dispatcher/payloads";
import SettingsStore from "../settings/SettingsStore";
import { CallStore } from "../stores/CallStore";
import { type Call } from "../models/Call";

vi.mock("../Modal.tsx");

describe("leaveRoomBehaviour", () => {
    SDKContextClass.instance.constructEagerStores(); // Initialize RoomViewStore

    let client: Mocked<MatrixClient>;
    let room: Mocked<Room>;
    let space: Mocked<Room>;

    beforeEach(async () => {
        stubClient();
        client = vi.mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(client);

        room = mkRoom(client, "!1:example.org");
        space = mkRoom(client, "!2:example.org");
        space.isSpaceRoom.mockReturnValue(true);
        client.getRoom.mockImplementation((roomId) => {
            switch (roomId) {
                case room.roomId:
                    return room;
                case space.roomId:
                    return space;
                default:
                    return null;
            }
        });

        await setupAsyncStoreWithClient(SDKContextClass.instance.spaceStore, client);
    });

    afterEach(async () => {
        SDKContextClass.instance.spaceStore.setActiveSpace(MetaSpace.Home);
        await resetAsyncStoreWithClient(SDKContextClass.instance.spaceStore);
        vi.restoreAllMocks();
    });

    const viewRoom = (room: Room) =>
        defaultDispatcher.dispatch<ViewRoomPayload>(
            {
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: undefined,
            },
            true,
        );

    const expectDispatch = async <T extends ActionPayload>(payload: T) => {
        const dispatcherSpy = vi.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
        await sleep(0);
        expect(dispatcherSpy).toHaveBeenCalledWith(payload);
        defaultDispatcher.unregister(dispatcherRef);
    };

    it("hangs up legacy calls when leaving a room", async () => {
        const hangupSpy = vi
            .spyOn(SDKContextClass.instance.legacyCallHandler, "hangupOrReject")
            .mockImplementation(() => {});

        viewRoom(room);
        await leaveRoomBehaviour(client, room.roomId);

        expect(hangupSpy).toHaveBeenCalledWith(room.roomId);
    });

    it("disconnects widget-based calls when leaving a room", async () => {
        const mockCall = {
            disconnect: vi.fn().mockResolvedValue(undefined),
        } as unknown as Call;

        vi.spyOn(CallStore.instance, "getActiveCall").mockReturnValue(mockCall);

        viewRoom(room);
        await leaveRoomBehaviour(client, room.roomId);

        expect(mockCall.disconnect).toHaveBeenCalled();
    });

    it("returns to the home page after leaving a room outside of a space that was being viewed", async () => {
        viewRoom(room);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({ action: Action.ViewHomePage });
    });

    it("returns to the parent space after leaving a room inside of a space that was being viewed", async () => {
        vi.spyOn(SDKContextClass.instance.spaceStore, "getCanonicalParent").mockImplementation((roomId) =>
            roomId === room.roomId ? space : null,
        );
        viewRoom(room);
        SDKContextClass.instance.spaceStore.setActiveSpace(space.roomId, false);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined,
        });
    });

    it("returns to the home page after leaving a top-level space that was being viewed", async () => {
        viewRoom(space);
        SDKContextClass.instance.spaceStore.setActiveSpace(space.roomId, false);

        await leaveRoomBehaviour(client, space.roomId);
        await expectDispatch({ action: Action.ViewHomePage });
    });

    it("returns to the parent space after leaving a subspace that was being viewed", async () => {
        room.isSpaceRoom.mockReturnValue(true);
        vi.spyOn(SDKContextClass.instance.spaceStore, "getCanonicalParent").mockImplementation((roomId) =>
            roomId === room.roomId ? space : null,
        );
        viewRoom(room);
        SDKContextClass.instance.spaceStore.setActiveSpace(room.roomId, false);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined,
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            await leaveRoomBehaviour(client, room.roomId);
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, true, false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            await leaveRoomBehaviour(client, room.roomId);
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, true, true);
        });
    });
});
