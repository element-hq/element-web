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
import { MatrixWidgetType } from "matrix-widget-api";

// We can't use the usual `skinned-sdk`, as it stubs out the RightPanel
import "../../../minimal-sdk";
import RightPanel from "../../../../src/components/structures/RightPanel";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { stubClient } from "../../../test-utils";
import { Action } from "../../../../src/dispatcher/actions";
import dis from "../../../../src/dispatcher/dispatcher";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../../src/stores/AsyncStore";
import WidgetStore, { IApp } from "../../../../src/stores/WidgetStore";
import AppTile from "../../../../src/components/views/elements/AppTile";
import { Container, WidgetLayoutStore } from "../../../../src/stores/widgets/WidgetLayoutStore";
import AppsDrawer from "../../../../src/components/views/rooms/AppsDrawer";

describe("AppTile", () => {
    let cli;
    let r1;
    let r2;
    const resizeNotifier = new ResizeNotifier();
    let app: IApp;

    beforeAll(async () => {
        stubClient();
        cli = MatrixClientPeg.get();
        cli.hasLazyLoadMembersEnabled = () => false;

        // Init misc. startup deps
        DMRoomMap.makeShared();

        r1 = new Room("r1", cli, "@name:example.com");
        r2 = new Room("r2", cli, "@name:example.com");

        jest.spyOn(cli, "getRoom").mockImplementation(roomId => {
            if (roomId === "r1") return r1;
            if (roomId === "r2") return r2;
            return null;
        });
        jest.spyOn(cli, "getVisibleRooms").mockImplementation(() => {
            return [r1, r2];
        });

        // Adjust various widget stores to add a mock app
        app = {
            id: "1",
            eventId: "1",
            roomId: "r1",
            type: MatrixWidgetType.Custom,
            url: "https://example.com",
            name: "Example",
            creatorUserId: cli.getUserId(),
            avatar_url: null,
        };
        jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([app]);

        // Wake up various stores we rely on
        WidgetLayoutStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await WidgetLayoutStore.instance.onReady();
        RightPanelStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await RightPanelStore.instance.onReady();
    });

    it("destroys non-persisted right panel widget on room change", async () => {
        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        const mockSettings = jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{
                        phase: RightPanelPhases.Widget,
                        state: {
                            widgetId: "1",
                        },
                    }],
                    isOpen: true,
                };
            }
            return null;
        });

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
                    RightPanelPhases.Widget
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

        expect(AppTile.isLive("1")).toBe(true);

        // We want to verify that as we change to room 2, we should close the
        // right panel and destroy the widget.
        const instance = renderer.root.findByType(AppTile).instance;
        const endWidgetActions = jest.spyOn(instance, "endWidgetActions");

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

        expect(endWidgetActions.mock.calls.length).toBe(1);
        expect(AppTile.isLive("1")).toBe(false);

        mockSettings.mockRestore();
    });

    it("preserves non-persisted widget on container move", async () => {
        // Set up widget in top container
        const realGetValue = SettingsStore.getValue;
        const mockSettings = jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "Widgets.layout") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    widgets: {
                        1: {
                            container: Container.Top,
                        },
                    },
                };
            }
            return null;
        });

        TestRenderer.act(() => {
            WidgetLayoutStore.instance.recalculateRoom(r1);
        });

        // Run initial render with room 1, and also running lifecycle methods
        const renderer = TestRenderer.create(<MatrixClientContext.Provider value={cli}>
            <AppsDrawer
                userId={cli.getUserId()}
                room={r1}
                resizeNotifier={resizeNotifier}
            />
        </MatrixClientContext.Provider>);

        expect(AppTile.isLive("1")).toBe(true);

        // We want to verify that as we move the widget to the center container,
        // the widget frame remains running.
        const instance = renderer.root.findByType(AppTile).instance;
        const endWidgetActions = jest.spyOn(instance, "endWidgetActions");

        // Move widget to center

        // Stop mocking settings so that the widget move can take effect
        mockSettings.mockRestore();
        TestRenderer.act(() => {
            WidgetLayoutStore.instance.moveToContainer(r1, app, Container.Center);
        });

        expect(endWidgetActions.mock.calls.length).toBe(0);
        expect(AppTile.isLive("1")).toBe(true);
    });

    afterAll(async () => {
        // @ts-ignore
        await WidgetLayoutStore.instance.onNotReady();
        // @ts-ignore
        await RightPanelStore.instance.onNotReady();
        jest.restoreAllMocks();
    });
});
