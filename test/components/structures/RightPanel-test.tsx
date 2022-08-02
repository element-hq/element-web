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
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { jest } from "@jest/globals";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";

import _RightPanel from "../../../src/components/structures/RightPanel";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { stubClient, wrapInMatrixClientContext, mkRoom } from "../../test-utils";
import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import SettingsStore from "../../../src/settings/SettingsStore";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../src/stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import RoomSummaryCard from "../../../src/components/views/right_panel/RoomSummaryCard";
import MemberList from "../../../src/components/views/rooms/MemberList";

const RightPanel = wrapInMatrixClientContext(_RightPanel);

describe("RightPanel", () => {
    const resizeNotifier = new ResizeNotifier();

    let cli: MockedObject<MatrixClient>;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.get());
        DMRoomMap.makeShared();
    });

    afterEach(async () => {
        const roomChanged = new Promise<void>(resolve => {
            const ref = dis.register(payload => {
                if (payload.action === Action.ActiveRoomChanged) {
                    dis.unregister(ref);
                    resolve();
                }
            });
        });
        dis.fire(Action.ViewHomePage); // Stop viewing any rooms
        await roomChanged;

        dis.fire(Action.OnLoggedOut, true); // Shut down the stores
        jest.restoreAllMocks();
    });

    const spinUpStores = async () => {
        // Selectively spin up the stores we need
        WidgetLayoutStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        // This is private but it's the only way to selectively enable stores
        await WidgetLayoutStore.instance.onReady();

        // Make sure we start with a clean store
        RightPanelStore.instance.reset();
        RightPanelStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await RightPanelStore.instance.onReady();
    };

    const waitForRpsUpdate = () =>
        new Promise<void>(resolve => RightPanelStore.instance.once(UPDATE_EVENT, resolve));

    it("navigates from room summary to member list", async () => {
        const r1 = mkRoom(cli, "r1");
        cli.getRoom.mockImplementation(roomId => roomId === "r1" ? r1 : null);

        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{ phase: RightPanelPhases.RoomSummary }],
                    isOpen: true,
                };
            }
            return null;
        });

        await spinUpStores();
        const viewedRoom = waitForRpsUpdate();
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await viewedRoom;

        const wrapper = mount(<RightPanel room={r1} resizeNotifier={resizeNotifier} />);
        expect(wrapper.find(RoomSummaryCard).exists()).toEqual(true);

        const switchedPhases = waitForRpsUpdate();
        wrapper.find("AccessibleButton.mx_RoomSummaryCard_icon_people").simulate("click");
        await switchedPhases;
        wrapper.update();

        expect(wrapper.find(MemberList).exists()).toEqual(true);
    });

    it("renders info from only one room during room changes", async () => {
        const r1 = mkRoom(cli, "r1");
        const r2 = mkRoom(cli, "r2");

        cli.getRoom.mockImplementation(roomId => {
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

        await spinUpStores();

        // Run initial render with room 1, and also running lifecycle methods
        const wrapper = mount(<RightPanel room={r1} resizeNotifier={resizeNotifier} />);
        // Wait for RPS room 1 updates to fire
        const rpsUpdated = waitForRpsUpdate();
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated;

        // After all that setup, now to the interesting part...
        // We want to verify that as we change to room 2, we should always have
        // the correct right panel state for whichever room we are showing.
        const instance = wrapper.find(_RightPanel).instance() as _RightPanel;
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
        wrapper.setProps({ room: r2 });

        await rendered;
    });
});
