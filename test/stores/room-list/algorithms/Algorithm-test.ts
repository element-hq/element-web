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

import { stubClient, stubVideoChannelStore, mkRoom } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import { SortAlgorithm, ListAlgorithm } from "../../../../src/stores/room-list/algorithms/models";
import "../../../../src/stores/room-list/RoomListStore"; // must be imported before Algorithm to avoid cycles
import { Algorithm } from "../../../../src/stores/room-list/algorithms/Algorithm";

describe("Algorithm", () => {
    let videoChannelStore;
    let algorithm;
    let textRoom;
    let videoRoom;
    beforeEach(() => {
        stubClient();
        const cli = MatrixClientPeg.get();
        DMRoomMap.makeShared();
        videoChannelStore = stubVideoChannelStore();
        algorithm = new Algorithm();
        algorithm.start();

        textRoom = mkRoom(cli, "!text:example.org");
        videoRoom = mkRoom(cli, "!video:example.org");
        videoRoom.isElementVideoRoom.mockReturnValue(true);
        algorithm.populateTags(
            { [DefaultTagID.Untagged]: SortAlgorithm.Alphabetic },
            { [DefaultTagID.Untagged]: ListAlgorithm.Natural },
        );
        algorithm.setKnownRooms([textRoom, videoRoom]);
    });

    afterEach(() => {
        algorithm.stop();
    });

    it("sticks video rooms to the top when they connect", () => {
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([textRoom, videoRoom]);
        videoChannelStore.connect("!video:example.org");
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([videoRoom, textRoom]);
    });

    it("unsticks video rooms from the top when they disconnect", () => {
        videoChannelStore.connect("!video:example.org");
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([videoRoom, textRoom]);
        videoChannelStore.disconnect();
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([textRoom, videoRoom]);
    });
});
