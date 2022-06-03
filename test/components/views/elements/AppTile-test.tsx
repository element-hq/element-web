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
import { mount, ReactWrapper } from "enzyme";
import { Optional } from "matrix-events-sdk";

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
import ActiveWidgetStore from "../../../../src/stores/ActiveWidgetStore";
import AppTile from "../../../../src/components/views/elements/AppTile";
import { Container, WidgetLayoutStore } from "../../../../src/stores/widgets/WidgetLayoutStore";
import AppsDrawer from "../../../../src/components/views/rooms/AppsDrawer";

describe("AppTile", () => {
    let cli;
    let r1;
    let r2;
    const resizeNotifier = new ResizeNotifier();
    let app1: IApp;
    let app2: IApp;

    const waitForRps = (roomId: string) => new Promise<void>(resolve => {
        const update = () => {
            if (
                RightPanelStore.instance.currentCardForRoom(roomId).phase !==
                RightPanelPhases.Widget
            ) return;
            RightPanelStore.instance.off(UPDATE_EVENT, update);
            resolve();
        };
        RightPanelStore.instance.on(UPDATE_EVENT, update);
    });

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

        // Adjust various widget stores to add mock apps
        app1 = {
            id: "1",
            eventId: "1",
            roomId: "r1",
            type: MatrixWidgetType.Custom,
            url: "https://example.com",
            name: "Example 1",
            creatorUserId: cli.getUserId(),
            avatar_url: null,
        };
        app2 = {
            id: "1",
            eventId: "2",
            roomId: "r2",
            type: MatrixWidgetType.Custom,
            url: "https://example.com",
            name: "Example 2",
            creatorUserId: cli.getUserId(),
            avatar_url: null,
        };
        jest.spyOn(WidgetStore.instance, "getApps").mockImplementation(roomId => {
            if (roomId === "r1") return [app1];
            if (roomId === "r2") return [app2];
        });

        // Wake up various stores we rely on
        WidgetLayoutStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await WidgetLayoutStore.instance.onReady();
        RightPanelStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await RightPanelStore.instance.onReady();
    });

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
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
        const rpsUpdated = waitForRps("r1");
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated;

        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

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
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(false);

        mockSettings.mockRestore();
    });

    it("distinguishes widgets with the same ID in different rooms", async () => {
        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, 'getValue').mockImplementation((name, roomId) => {
            if (name === "RightPanel.phases") {
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
            }
            return realGetValue(name, roomId);
        });

        // Run initial render with room 1, and also running lifecycle methods
        const renderer = TestRenderer.create(<MatrixClientContext.Provider value={cli}>
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
            />
        </MatrixClientContext.Provider>);
        // Wait for RPS room 1 updates to fire
        const rpsUpdated1 = waitForRps("r1");
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated1;

        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);
        expect(ActiveWidgetStore.instance.isLive("1", "r2")).toBe(false);

        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name === "RightPanel.phases") {
                if (roomId === "r2") {
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
            }
            return realGetValue(name, roomId);
        });
        // Wait for RPS room 2 updates to fire
        const rpsUpdated2 = waitForRps("r2");
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
        await rpsUpdated2;

        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(false);
        expect(ActiveWidgetStore.instance.isLive("1", "r2")).toBe(true);
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

        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

        // We want to verify that as we move the widget to the center container,
        // the widget frame remains running.
        const instance = renderer.root.findByType(AppTile).instance;
        const endWidgetActions = jest.spyOn(instance, "endWidgetActions");

        // Move widget to center

        // Stop mocking settings so that the widget move can take effect
        mockSettings.mockRestore();
        TestRenderer.act(() => {
            WidgetLayoutStore.instance.moveToContainer(r1, app1, Container.Center);
        });

        expect(endWidgetActions.mock.calls.length).toBe(0);
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);
    });

    afterAll(async () => {
        // @ts-ignore
        await WidgetLayoutStore.instance.onNotReady();
        // @ts-ignore
        await RightPanelStore.instance.onNotReady();
        jest.restoreAllMocks();
    });

    describe("for a pinned widget", () => {
        let wrapper: ReactWrapper;
        let moveToContainerSpy;

        beforeEach(() => {
            wrapper = mount((
                <MatrixClientContext.Provider value={cli}>
                    <AppTile
                        key={app1.id}
                        app={app1}
                        room={r1}
                    />
                </MatrixClientContext.Provider>
            ));

            moveToContainerSpy = jest.spyOn(WidgetLayoutStore.instance, 'moveToContainer');
        });

        it("clicking 'minimise' should send the widget to the right", () => {
            const minimiseButton = wrapper.find('.mx_AppTileMenuBar_iconButton_minimise');
            minimiseButton.first().simulate('click');
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Right);
        });

        it("clicking 'maximise' should send the widget to the center", () => {
            const minimiseButton = wrapper.find('.mx_AppTileMenuBar_iconButton_maximise');
            minimiseButton.first().simulate('click');
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Center);
        });

        describe("for a maximised (centered) widget", () => {
            beforeEach(() => {
                jest.spyOn(WidgetLayoutStore.instance, 'isInContainer').mockImplementation(
                    (room: Optional<Room>, widget: IApp, container: Container) => {
                        return room === r1 && widget === app1 && container === Container.Center;
                    },
                );
            });

            it("clicking 'un-maximise' should send the widget to the top", () => {
                const unMaximiseButton = wrapper.find('.mx_AppTileMenuBar_iconButton_collapse');
                unMaximiseButton.first().simulate('click');
                expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Top);
            });
        });
    });
});
