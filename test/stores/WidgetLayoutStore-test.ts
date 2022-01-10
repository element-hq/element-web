/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import "../skinned-sdk"; // Must be first for skinning to work
import { Room } from "matrix-js-sdk";

import WidgetStore, { IApp } from "../../src/stores/WidgetStore";
import { Container, WidgetLayoutStore } from "../../src/stores/widgets/WidgetLayoutStore";
import { stubClient } from "../test-utils";

// setup test env values
const roomId = "!room:server";
const mockRoom = <Room>{
    roomId: roomId,
    currentState: {
        getStateEvents: (_l, _x) => {
            return {
                getId: () => "$layoutEventId",
                getContent: () => null,
            };
        },
    } };

const mockApps = [
        <IApp> { roomId: roomId, id: "1" },
        <IApp> { roomId: roomId, id: "2" },
        <IApp> { roomId: roomId, id: "3" },
        <IApp> { roomId: roomId, id: "4" },
];

// fake the WidgetStore.instance to just return an object with `getApps`
jest.spyOn(WidgetStore, 'instance', 'get').mockReturnValue(<WidgetStore>{ getApps: (_room) => mockApps });

describe("WidgetLayoutStore", () => {
    // we need to init a client so it does not error, when asking for DeviceStorage handlers (SettingsStore.setValue("Widgets.layout"))
    stubClient();

    const store = WidgetLayoutStore.instance;

    it("all widgets should be in the right container by default", async () => {
        store.recalculateRoom(mockRoom);
        expect(store.getContainerWidgets(mockRoom, Container.Right).length).toStrictEqual(mockApps.length);
    });
    it("add widget to top container", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        expect(store.getContainerWidgets(mockRoom, Container.Top)).toStrictEqual([mockApps[0]]);
    });
    it("add three widgets to top container", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        store.moveToContainer(mockRoom, mockApps[1], Container.Top);
        store.moveToContainer(mockRoom, mockApps[2], Container.Top);
        expect(new Set(store.getContainerWidgets(mockRoom, Container.Top)))
            .toEqual(new Set([mockApps[0], mockApps[1], mockApps[2]]));
    });
    it("cannot add more than three widgets to top container", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        store.moveToContainer(mockRoom, mockApps[1], Container.Top);
        store.moveToContainer(mockRoom, mockApps[2], Container.Top);
        expect(store.canAddToContainer(mockRoom, Container.Top))
            .toEqual(false);
    });
    it("remove pins when maximising (other widget)", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        store.moveToContainer(mockRoom, mockApps[1], Container.Top);
        store.moveToContainer(mockRoom, mockApps[2], Container.Top);
        store.moveToContainer(mockRoom, mockApps[3], Container.Center);
        expect(store.getContainerWidgets(mockRoom, Container.Top))
            .toEqual([]);
        expect(new Set(store.getContainerWidgets(mockRoom, Container.Right)))
            .toEqual(new Set([mockApps[0], mockApps[1], mockApps[2]]));
        expect(store.getContainerWidgets(mockRoom, Container.Center))
            .toEqual([mockApps[3]]);
    });
    it("remove pins when maximising (one of the pinned widgets)", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        store.moveToContainer(mockRoom, mockApps[1], Container.Top);
        store.moveToContainer(mockRoom, mockApps[2], Container.Top);
        store.moveToContainer(mockRoom, mockApps[0], Container.Center);
        expect(store.getContainerWidgets(mockRoom, Container.Top))
            .toEqual([]);
        expect(store.getContainerWidgets(mockRoom, Container.Center))
            .toEqual([mockApps[0]]);
        expect(new Set(store.getContainerWidgets(mockRoom, Container.Right)))
            .toEqual(new Set([mockApps[1], mockApps[2], mockApps[3]]));
    });
    it("remove maximised when pinning (other widget)", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Center);
        store.moveToContainer(mockRoom, mockApps[1], Container.Top);
        expect(store.getContainerWidgets(mockRoom, Container.Top))
            .toEqual([mockApps[1]]);
        expect(store.getContainerWidgets(mockRoom, Container.Center))
            .toEqual([]);
        expect(new Set(store.getContainerWidgets(mockRoom, Container.Right)))
            .toEqual(new Set([mockApps[2], mockApps[3], mockApps[0]]));
    });
    it("remove maximised when pinning (same widget)", async () => {
        store.recalculateRoom(mockRoom);
        store.moveToContainer(mockRoom, mockApps[0], Container.Center);
        store.moveToContainer(mockRoom, mockApps[0], Container.Top);
        expect(store.getContainerWidgets(mockRoom, Container.Top))
            .toEqual([mockApps[0]]);
        expect(store.getContainerWidgets(mockRoom, Container.Center))
            .toEqual([]);
        expect(new Set(store.getContainerWidgets(mockRoom, Container.Right)))
            .toEqual(new Set([mockApps[2], mockApps[3], mockApps[1]]));
    });
});
