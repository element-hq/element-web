/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import React from "react";
import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type IWidget, MatrixWidgetType } from "matrix-widget-api";
import { act, render, waitForElementToBeRemoved, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import {
    type ApprovalOpts,
    type WidgetInfo,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";
import { clientAndSDKContextRenderOptions, stubClient, TestSDKContext } from "test-utils";

import RightPanel from "../../structures/RightPanel";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import { Action } from "../../../dispatcher/actions";
import dis from "../../../dispatcher/dispatcher";
import DMRoomMap from "../../../utils/DMRoomMap";
import SettingsStore from "../../../settings/SettingsStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import WidgetStore, { type IApp } from "../../../stores/WidgetStore";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import AppTile from "./AppTile";
import { type Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import AppsDrawer from "../rooms/AppsDrawer";
import { ElementWidgetCapabilities } from "../../../stores/widgets/ElementWidgetCapabilities";
import { ElementWidget, type WidgetMessaging } from "../../../stores/widgets/WidgetMessaging";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { ModuleRunner } from "../../../modules/ModuleRunner";
import { ModuleApi } from "../../../modules/Api";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";

vi.mock("../../../../res/img/element-icons/room/default_app.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_video.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_cal.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_doc.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_clock.svg", () => ({ default: "image-file-stub" }));

vi.mock("../../../stores/OwnProfileStore", () => ({
    OwnProfileStore: {
        instance: {
            on: vi.fn(),
            isProfileInfoFetched: true,
            removeListener: vi.fn(),
            getHttpAvatarUrl: vi.fn().mockReturnValue("http://avatar_url"),
        },
    },
}));

const realGetValue = SettingsStore.getValue;

describe("AppTile", () => {
    let cli: MatrixClient;
    let sdkContext: TestSDKContext;
    let r1: Room;
    let r2: Room;
    const resizeNotifier = new ResizeNotifier();
    let app1: IApp;
    let app2: IApp;

    beforeAll(async () => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.hasLazyLoadMembersEnabled = () => false;

        // Init misc. startup deps
        DMRoomMap.makeShared(cli);

        r1 = new Room("r1", cli, "@name:example.com");
        r2 = new Room("r2", cli, "@name:example.com");

        vi.spyOn(r1, "getPendingEvents").mockReturnValue([]);
        vi.spyOn(r2, "getPendingEvents").mockReturnValue([]);
        vi.spyOn(cli, "getRoom").mockImplementation((roomId) => {
            if (roomId === "r1") return r1;
            if (roomId === "r2") return r2;
            return null;
        });
        vi.spyOn(cli, "getVisibleRooms").mockImplementation(() => {
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
        vi.spyOn(WidgetStore.instance, "getApps").mockImplementation((roomId: string): Array<IApp> => {
            if (roomId === "r1") return [app1];
            if (roomId === "r2") return [app2];
            return [];
        });
    });

    afterAll(async () => {
        vi.restoreAllMocks();
    });

    beforeEach(async () => {
        // Do not carry across settings from previous tests
        SettingsStore.reset();
        sdkContext = new TestSDKContext();
        sdkContext._client = cli;
        // @ts-ignore
        await WidgetMessagingStore.instance.onReady();

        // Wake up various stores we rely on
        sdkContext.widgetLayoutStore.useUnitTestClient(cli);
        // @ts-ignore
        await sdkContext.widgetLayoutStore.onReady();

        sdkContext.rightPanelStore.useUnitTestClient(cli);
        // @ts-ignore
        await sdkContext.rightPanelStore.onReady();
    });

    afterEach(async () => {
        vi.spyOn(SettingsStore, "getValue").mockRestore();
        // @ts-ignore
        await WidgetLayoutStore.instance.onNotReady();
        // @ts-ignore
        await RightPanelStore.instance.onNotReady();
    });

    it("destroys non-persisted right panel widget on room change", async () => {
        // Set up right panel state
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
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
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
            />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        act(() =>
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: "r1",
            }),
        );

        await expect(renderResult.findByText("Example 1")).resolves.toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

        const { asFragment } = renderResult;
        expect(asFragment()).toMatchSnapshot();
        // We want to verify that as we change to room 2, we should close the
        // right panel and destroy the widget.

        // Switch to room 2
        act(() =>
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: "r2",
            }),
        );

        renderResult.rerender(
            <RightPanel
                room={r2}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r2, r2.roomId)}
            />,
        );

        expect(renderResult.queryByText("Example 1")).not.toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(false);
    });

    it("distinguishes widgets with the same ID in different rooms", async () => {
        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
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
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
            />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        act(() =>
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: "r1",
            }),
        );

        await waitFor(() => {
            expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);
            expect(ActiveWidgetStore.instance.isLive("1", "r2")).toBe(false);
        });

        vi.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
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
        // Switch to room 2
        act(() =>
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: "r2",
            }),
        );
        renderResult.rerender(
            <RightPanel
                room={r2}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r2, r2.roomId)}
            />,
        );

        await waitFor(() => {
            expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(false);
            expect(ActiveWidgetStore.instance.isLive("1", "r2")).toBe(true);
        });
    });

    it("preserves non-persisted widget on container move", async () => {
        // Set up widget in top container
        const realGetValue = SettingsStore.getValue;
        const mockSettings = vi.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "Widgets.layout") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    widgets: {
                        1: {
                            container: "top",
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
            <AppsDrawer userId={cli.getSafeUserId()} room={r1} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );

        expect(renderResult.getByText("Example 1")).toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);

        const { asFragment } = renderResult;
        expect(asFragment()).toMatchSnapshot(); // Take snapshot of AppsDrawer with AppTile

        // We want to verify that as we move the widget to the center container,
        // the widget frame remains running.

        // Stop mocking settings so that the widget move can take effect
        mockSettings.mockRestore();
        act(() => {
            // Move widget to center
            WidgetLayoutStore.instance.moveToContainer(r1, app1, "center");
        });

        expect(renderResult.getByText("Example 1")).toBeInTheDocument();
        expect(ActiveWidgetStore.instance.isLive("1", "r1")).toBe(true);
    });

    it("should hangup Jitsi call when room is left", async () => {
        const app: IApp = {
            id: "3",
            eventId: "jitsi1",
            roomId: "r2",
            type: MatrixWidgetType.JitsiMeet,
            url: "https://jitsi.example.com",
            name: "Jitsi Conference",
            creatorUserId: cli.getSafeUserId(),
            avatar_url: undefined,
        };

        const { queryByRole, getByText } = render(
            <AppTile key={app.id} app={app} room={r2} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        await waitForElementToBeRemoved(() => queryByRole("progressbar"));

        expect(getByText("Jitsi Conference")).toBeInTheDocument();

        // Switch to room 1
        dis.dispatch(
            {
                action: Action.ViewRoom,
                room_id: "r1",
            },
            true,
        );
        vi.spyOn(ActiveWidgetStore.instance, "getWidgetPersistence").mockReturnValue(true);
        vi.spyOn(sdkContext.legacyCallHandler, "hangupCallApp");
        dis.dispatch(
            {
                action: Action.AfterLeaveRoom,
                room_id: "r2",
            },
            true,
        );

        expect(sdkContext.legacyCallHandler.hangupCallApp).toHaveBeenCalledWith(app.roomId);
    });

    describe("for a pinned widget", () => {
        let moveToContainerSpy: MockInstance<(room: Room, widget: IWidget, toContainer: Container) => void>;
        beforeEach(async () => {
            moveToContainerSpy = vi.spyOn(WidgetLayoutStore.instance, "moveToContainer");
        });

        it("should render", async () => {
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
            const { asFragment } = renderResult;

            expect(asFragment()).toMatchSnapshot(); // Take a snapshot of the pinned widget
        });

        it("should not display the »Popout widget« button", async () => {
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
            expect(renderResult.queryByLabelText("Popout widget")).not.toBeInTheDocument();
        });

        it("clicking 'minimise' should send the widget to the right", async () => {
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
            await userEvent.click(renderResult.getByLabelText("Minimise"));
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, "right");
        });

        it("should close right panel timeline when minimising widget", async () => {
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));

            vi.spyOn(sdkContext.rightPanelStore, "currentCardForRoom").mockReturnValue({
                phase: RightPanelPhases.Timeline,
            });
            vi.spyOn(sdkContext.rightPanelStore, "popCard");

            await userEvent.click(renderResult.getByLabelText("Minimise"));
            expect(sdkContext.rightPanelStore.popCard).toHaveBeenCalledWith(r1.roomId);
        });

        it("clicking 'maximise' should send the widget to the center", async () => {
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
            await userEvent.click(renderResult.getByLabelText("Maximise"));
            expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, "center");
        });

        it("should render permission request", async () => {
            vi.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
                if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === app1.id) {
                    (opts as ApprovalOpts).approved = false;
                }
            });

            // userId and creatorUserId are different
            const { container, asFragment, queryByRole } = render(
                <AppTile key={app1.id} app={app1} room={r1} userId="@user1" creatorUserId="@userAnother" />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            expect(container.querySelector(".mx_Spinner")).toBeFalsy();
            expect(queryByRole("button", { name: "Continue" })).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should not display 'Continue' button on permission load", async () => {
            vi.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
                if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === app1.id) {
                    (opts as ApprovalOpts).approved = true;
                }
            });

            // userId and creatorUserId are different
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} userId="@user1" creatorUserId="@userAnother" />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));

            expect(renderResult.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
        });

        it("should auto-approve preload via new widget lifecycle API", async () => {
            // Legacy module API denies preload
            vi.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
                if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === app1.id) {
                    (opts as ApprovalOpts).approved = false;
                }
            });

            // New API approves preload
            vi.spyOn(ModuleApi.instance.widgetLifecycle, "preapprovePreload").mockResolvedValue(true);

            // userId and creatorUserId are different so legacy path would show "Continue"
            const renderResult = render(
                <AppTile key={app1.id} app={app1} room={r1} userId="@user1" creatorUserId="@userAnother" />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );

            // The new API runs async in componentDidMount, so wait for it to take effect
            await waitFor(() => {
                expect(renderResult.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
            });
        });

        describe("for a maximised (centered) widget", () => {
            beforeEach(() => {
                vi.spyOn(WidgetLayoutStore.instance, "isInContainer").mockImplementation(
                    (room: Room | null, widget: IWidget, container: Container) => {
                        return room === r1 && widget === app1 && container === "center";
                    },
                );
            });

            afterEach(() => {
                vi.spyOn(WidgetLayoutStore.instance, "isInContainer").mockRestore();
            });

            it("clicking 'un-maximise' should send the widget to the top", async () => {
                const renderResult = render(
                    <AppTile key={app1.id} app={app1} room={r1} />,
                    clientAndSDKContextRenderOptions(cli, sdkContext),
                );
                await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
                await userEvent.click(renderResult.getByLabelText("Un-maximise"));
                expect(moveToContainerSpy).toHaveBeenCalledWith(r1, app1, "top");
            });
        });

        describe("with an existing widgetApi with requiresClient = false", () => {
            beforeEach(() => {
                const messaging = {
                    on: () => {},
                    off: () => {},
                    prepare: async () => {},
                    stop: () => {},
                    widgetApi: {
                        hasCapability: (capability: ElementWidgetCapabilities): boolean => {
                            return !(capability === ElementWidgetCapabilities.RequiresClient);
                        },
                    },
                } as unknown as WidgetMessaging;

                const mockWidget = new ElementWidget(app1);
                WidgetMessagingStore.instance.storeMessaging(mockWidget, r1.roomId, messaging);
            });

            it("should display the »Popout widget« button", async () => {
                const renderResult = render(
                    <AppTile key={app1.id} app={app1} room={r1} />,
                    clientAndSDKContextRenderOptions(cli, sdkContext),
                );
                await waitForElementToBeRemoved(() => renderResult.queryByRole("progressbar"));
                expect(renderResult.getByLabelText("Popout widget")).toBeInTheDocument();
            });
        });
    });

    describe("for a persistent app", () => {
        it("should render", async () => {
            const { asFragment, queryByRole } = render(
                <AppTile key={app1.id} app={app1} room={r1} fullWidth={true} miniMode={true} showMenubar={false} />,
                clientAndSDKContextRenderOptions(cli, sdkContext),
            );
            await waitForElementToBeRemoved(() => queryByRole("progressbar"));
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
