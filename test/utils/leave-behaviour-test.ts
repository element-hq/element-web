/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { mocked, Mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { mkRoom, resetAsyncStoreWithClient, setupAsyncStoreWithClient, stubClient } from "../test-utils";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { ViewRoomPayload } from "../../src/dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../src/dispatcher/actions";
import { leaveRoomBehaviour } from "../../src/utils/leave-behaviour";
import { SdkContextClass } from "../../src/contexts/SDKContext";
import DMRoomMap from "../../src/utils/DMRoomMap";
import SpaceStore from "../../src/stores/spaces/SpaceStore";
import { MetaSpace } from "../../src/stores/spaces";
import { ActionPayload } from "../../src/dispatcher/payloads";
import SettingsStore from "../../src/settings/SettingsStore";

describe("leaveRoomBehaviour", () => {
    SdkContextClass.instance.constructEagerStores(); // Initialize RoomViewStore

    let client: Mocked<MatrixClient>;
    let room: Mocked<Room>;
    let space: Mocked<Room>;

    beforeEach(async () => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
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

        await setupAsyncStoreWithClient(SpaceStore.instance, client);
    });

    afterEach(async () => {
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);
        await resetAsyncStoreWithClient(SpaceStore.instance);
        jest.restoreAllMocks();
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
        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
        await new Promise<void>((resolve) => setImmediate(resolve)); // Flush the dispatcher
        expect(dispatcherSpy).toHaveBeenCalledWith(payload);
        defaultDispatcher.unregister(dispatcherRef);
    };

    it("returns to the home page after leaving a room outside of a space that was being viewed", async () => {
        viewRoom(room);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({ action: Action.ViewHomePage });
    });

    it("returns to the parent space after leaving a room inside of a space that was being viewed", async () => {
        jest.spyOn(SpaceStore.instance, "getCanonicalParent").mockImplementation((roomId) =>
            roomId === room.roomId ? space : null,
        );
        viewRoom(room);
        SpaceStore.instance.setActiveSpace(space.roomId, false);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined,
        });
    });

    it("returns to the home page after leaving a top-level space that was being viewed", async () => {
        viewRoom(space);
        SpaceStore.instance.setActiveSpace(space.roomId, false);

        await leaveRoomBehaviour(client, space.roomId);
        await expectDispatch({ action: Action.ViewHomePage });
    });

    it("returns to the parent space after leaving a subspace that was being viewed", async () => {
        room.isSpaceRoom.mockReturnValue(true);
        jest.spyOn(SpaceStore.instance, "getCanonicalParent").mockImplementation((roomId) =>
            roomId === room.roomId ? space : null,
        );
        viewRoom(room);
        SpaceStore.instance.setActiveSpace(room.roomId, false);

        await leaveRoomBehaviour(client, room.roomId);
        await expectDispatch({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined,
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            await leaveRoomBehaviour(client, room.roomId);
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, false, false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            await leaveRoomBehaviour(client, room.roomId);
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, false, true);
        });
    });
});
