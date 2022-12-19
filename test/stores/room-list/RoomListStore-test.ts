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

import { ListAlgorithm, SortAlgorithm } from "../../../src/stores/room-list/algorithms/models";
import { OrderedDefaultTagIDs } from "../../../src/stores/room-list/models";
import RoomListStore, { RoomListStoreClass } from "../../../src/stores/room-list/RoomListStore";
import { stubClient } from "../../test-utils";

describe("RoomListStore", () => {
    beforeAll(async () => {
        const client = stubClient();
        await (RoomListStore.instance as RoomListStoreClass).makeReady(client);
    });

    it.each(OrderedDefaultTagIDs)("defaults to importance ordering for %s=", (tagId) => {
        expect(RoomListStore.instance.getTagSorting(tagId)).toBe(SortAlgorithm.Recent);
    });

    it.each(OrderedDefaultTagIDs)("defaults to activity ordering for %s=", (tagId) => {
        expect(RoomListStore.instance.getListOrder(tagId)).toBe(ListAlgorithm.Importance);
    });
});
