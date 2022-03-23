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

import React from "react";
import TestRenderer from "react-test-renderer";
import { jest } from "@jest/globals";
import { Room } from "matrix-js-sdk/src/models/room";

import RightPanel from "../../../src/components/structures/RightPanel";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { stubClient } from "../../test-utils";
import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../src/settings/SettingsStore";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../src/stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";

describe("RightPanel", () => {
    it("renders info from only one room during room changes", async () => {
        stubClient();
        const cli = MatrixClientPeg.get();
        cli.hasLazyLoadMembersEnabled = () => false;

        // Init misc. startup deps
        DMRoomMap.makeShared();

        const r1 = new Room("r1", cli, "@name:example.com");
        const r2 = new Room("r2", cli, "@name:example.com");

        jest.spyOn(cli, "getRoom").mockImplementation(roomId => {
            if (roomId === "r1") return r1;
            if (roomId === "r2") return r2;
            return null;
        });

        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{ phase: RightPanelPhases.RoomMemberList }],
                    isOpen: true,
                };
            }
            if (roomId === "r2") {
                return {
                    history: [{ phase: RightPanelPhases.RoomSummary }],
                    isOpen: true,
                };
            }
            return null;
        });

        // Wake up various stores we rely on
        WidgetLayoutStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await WidgetLayoutStore.instance.onReady();
        RightPanelStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await RightPanelStore.instance.onReady();

        const resizeNotifier = new ResizeNotifier();

        // Run initial render with room 1, and also running lifecycle methods
        const renderer = TestRenderer.create(<MatrixClientContext.Provider value={cli}>
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
            />
        </MatrixClientContext.Provider>);
        // Wait for RPS room 1 updates to fire
        const rpsUpdated = new Promise<void>(resolve => {
            const update = () => {
                if (
                    RightPanelStore.instance.currentCardForRoom("r1").phase !==
                    RightPanelPhases.RoomMemberList
                ) return;
                RightPanelStore.instance.off(UPDATE_EVENT, update);
                resolve();
            };
            RightPanelStore.instance.on(UPDATE_EVENT, update);
        });
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated;

        // After all that setup, now to the interesting part...
        // We want to verify that as we change to room 2, we should always have
        // the correct right panel state for whichever room we are showing.
        const instance = renderer.root.instance;
        const rendered = new Promise<void>(resolve => {
            jest.spyOn(instance, "render").mockImplementation(() => {
                const { props, state } = instance;
                if (props.room.roomId === "r2" && state.phase === RightPanelPhases.RoomMemberList) {
                    throw new Error("Tried to render room 1 state for room 2");
                }
                if (props.room.roomId === "r2" && state.phase === RightPanelPhases.RoomSummary) {
                    resolve();
                }
                return null;
            });
        });

        // Switch to room 2
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r2",
        });
        renderer.update(<MatrixClientContext.Provider value={cli}>
            <RightPanel
                room={r2}
                resizeNotifier={resizeNotifier}
            />
        </MatrixClientContext.Provider>);

        await rendered;
    });

    afterAll(async () => {
        // @ts-ignore
        await WidgetLayoutStore.instance.onNotReady();
        // @ts-ignore
        await RightPanelStore.instance.onNotReady();
        jest.restoreAllMocks();
    });
});
