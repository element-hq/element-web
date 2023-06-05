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
import { jest } from "@jest/globals";
import { Room } from "matrix-js-sdk/src/models/room";
import { ClientWidgetApi, IWidget, MatrixWidgetType } from "matrix-widget-api";
import { Optional } from "matrix-events-sdk";
import { act, render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { SpiedFunction } from "jest-mock";
import {
    ApprovalOpts,
    WidgetInfo,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

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
import { ElementWidgetCapabilities } from "../../../../src/stores/widgets/ElementWidgetCapabilities";
import { ElementWidget } from "../../../../src/stores/widgets/StopGapWidget";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { ModuleRunner } from "../../../../src/modules/ModuleRunner";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";

jest.mock("../../../../src/stores/OwnProfileStore", () => ({
    OwnProfileStore: {
        instance: {
            isProfileInfoFetched: true,
            removeListener: jest.fn(),
            getHttpAvatarUrl: jest.fn().mockReturnValue("http://avatar_url"),
        },
    },
}));

describe("AppTile", () => {
    let cli: MatrixClient;
    let r1: Room;
    let r2: Room;
    const resizeNotifier = new ResizeNotifier();
    let app1: IApp;
    let app2: IApp;

    const waitForRps = (roomId: string) =>
        new Promise<void>((resolve) => {
            const update = () => {
                if (RightPanelStore.instance.currentCardForRoom(roomId).phase !== RightPanelPhases.Widget) return;
                RightPanelStore.instance.off(UPDATE_EVENT, update);
                resolve();
            };
            RightPanelStore.instance.on(UPDATE_EVENT, update);
        });

    beforeAll(async () => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.hasLazyLoadMembersEnabled = () => false;

        // Init misc. startup deps
        DMRoomMap.makeShared(cli);

        r1 = new Room("r1", cli, "@name:example.com");
        r2 = new Room("r2", cli, "@name:example.com");

        jest.spyOn(cli, "getRoom").mockImplementation((roomId) => {
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
            creatorUserId: cli.getSafeUserId(),
            avatar_url: undefined,
        };
        app2 = {
            id: "1",
            eventId: "2",
            roomId: "r2",
            type: MatrixWidgetType.Custom,
            url: "https://example.com",
            name: "Example 2",
            creatorUserId: cli.getSafeUserId(),
            avatar_url: undefined,
        };
        jest.spyOn(WidgetStore.instance, "getApps").mockImplementation((roomId: string): Array<IApp> => {
            if (roomId === "r1") return [app1];
            if (roomId === "r2") return [app2];
            return [];
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
                    history: [
                        {
                            phase: RightPanelPhases.Widget,
                            state: {
                                widgetId: "1",
                            },
                        },
                    ],
                    isOpen: true,
                };
            }
            return null;
        });

        // Run initial render with room 1, and also running lifecycle methods
        const renderResult = render(
            <MatrixClientContext.Provider value={cli}>
                <RightPanel
                    room={r1}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
                />
            </MatrixClientContext.Provider>,
        );
        // Wait for RPS room 1 updates to fire
        const rpsUpdated = waitForRps("r1");
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated;

        expect(renderResult.getByText("Example 1")).toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

        const { container, asFragment } = renderResult;
        expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
        expect(asFragment()).toMatchSnapshot();

        // We want to verify that as we change to room 2, we should close the
        // right panel and destroy the widget.

        // Switch to room 2
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r2",
        });

        renderResult.rerender(
            <MatrixClientContext.Provider value={cli}>
                <RightPanel
                    room={r2}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={new RoomPermalinkCreator(r2, r2.roomId)}
                />
            </MatrixClientContext.Provider>,
        );

        expect(renderResult.queryByText("Example 1")).not.toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(false);

        mockSettings.mockRestore();
    });

    it("distinguishes widgets with the same ID in different rooms", async () => {
        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name === "RightPanel.phases") {
                if (roomId === "r1") {
                    return {
                        history: [
                            {
                                phase: RightPanelPhases.Widget,
                                state: {
                                    widgetId: "1",
                                },
                            },
                        ],
                        isOpen: true,
                    };
                }
                return null;
            }
            return realGetValue(name, roomId);
        });

        // Run initial render with room 1, and also running lifecycle methods
        const renderResult = render(
            <MatrixClientContext.Provider value={cli}>
                <RightPanel
                    room={r1}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
                />
            </MatrixClientContext.Provider>,
        );
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
                        history: [
                            {
                                phase: RightPanelPhases.Widget,
                                state: {
                                    widgetId: "1",
                                },
                            },
                        ],
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
        renderResult.rerender(
            <MatrixClientContext.Provider value={cli}>
                <RightPanel
                    room={r2}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={new RoomPermalinkCreator(r2, r2.roomId)}
                />
            </MatrixClientContext.Provider>,
        );
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

        act(() => {
            WidgetLayoutStore.instance.recalculateRoom(r1);
        });

        // Run initial render with room 1, and also running lifecycle methods
        const renderResult = render(
            <MatrixClientContext.Provider value={cli}>
                <AppsDrawer userId={cli.getSafeUserId()} room={r1} resizeNotifier={resizeNotifier} />
            </MatrixClientContext.Provider>,
        );

        expect(renderResult.getByText("Example 1")).toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

        // We want to verify that as we move the widget to the center container,
        // the widget frame remains running.

        // Stop mocking settings so that the widget move can take effect
        mockSettings.mockRestore();
        act(() => {
            // Move widget to center
            WidgetLayoutStore.instance.moveToContainer(r1, app1, Container.Center);
        });

        expect(renderResult.getByText("Example 1")).toBeInTheDocument();
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
        let renderResult: RenderResult;
        let moveToContainerSpy: SpiedFunction<typeof WidgetLayoutStore.instance.moveToContainer>;

        beforeEach(() => {
            renderResult = render(
                <MatrixClientContext.Provider value={cli}>
                    <AppTile key={app1.id} app={app1} room={r1} />
                </MatrixClientContext.Provider>,
            );

            moveToContainerSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");
        });

        it("should render", () => {
            const { container, asFragment } = renderResult;

            expect(container.querySelector(".mx_Spinner")).toBeFalsy(); // Assert that the spinner is gone
            expect(asFragment()).toMatchSnapshot(); // Take a snapshot of the pinned widget
        });

        it("should not display the »Popout widget« button", () => {
            expect(renderResult.queryByLabelText("Popout widget")).not.toBeInTheDocument();
        });

        it("clicking 'minimise' should send the widget to the right", async () => {
            await userEvent.click(renderResult.getByTitle("Minimise"));
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Right);
        });

        it("clicking 'maximise' should send the widget to the center", async () => {
            await userEvent.click(renderResult.getByTitle("Maximise"));
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Center);
        });

        describe("for a maximised (centered) widget", () => {
            beforeEach(() => {
                jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockImplementation(
                    (room: Optional<Room>, widget: IWidget, container: Container) => {
                        return room === r1 && widget === app1 && container === Container.Center;
                    },
                );
            });

            it("clicking 'un-maximise' should send the widget to the top", async () => {
                await userEvent.click(renderResult.getByTitle("Un-maximise"));
                expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, Container.Top);
            });
        });

        describe("with an existing widgetApi with requiresClient = false", () => {
            beforeEach(() => {
                const api = {
                    hasCapability: (capability: ElementWidgetCapabilities): boolean => {
                        return !(capability === ElementWidgetCapabilities.RequiresClient);
                    },
                    once: () => {},
                    stop: () => {},
                } as unknown as ClientWidgetApi;

                const mockWidget = new ElementWidget(app1);
                WidgetMessagingStore.instance.storeMessaging(mockWidget, r1.roomId, api);

                renderResult = render(
                    <MatrixClientContext.Provider value={cli}>
                        <AppTile key={app1.id} app={app1} room={r1} />
                    </MatrixClientContext.Provider>,
                );
            });

            it("should display the »Popout widget« button", () => {
                expect(renderResult.getByTitle("Popout widget")).toBeInTheDocument();
            });
        });
    });

    describe("for a persistent app", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(
                <MatrixClientContext.Provider value={cli}>
                    <AppTile key={app1.id} app={app1} fullWidth={true} room={r1} miniMode={true} showMenubar={false} />
                </MatrixClientContext.Provider>,
            );
        });

        it("should render", () => {
            const { container, asFragment } = renderResult;

            expect(container.querySelector(".mx_Spinner")).toBeFalsy();
            expect(asFragment()).toMatchSnapshot();
        });
    });

    it("for a pinned widget permission load", () => {
        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
            if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === app1.id) {
                (opts as ApprovalOpts).approved = true;
            }
        });

        // userId and creatorUserId are different
        const renderResult = render(
            <MatrixClientContext.Provider value={cli}>
                <AppTile key={app1.id} app={app1} room={r1} userId="@user1" creatorUserId="@userAnother" />
            </MatrixClientContext.Provider>,
        );

        expect(renderResult.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    });
});
