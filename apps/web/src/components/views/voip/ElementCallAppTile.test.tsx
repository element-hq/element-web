/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import {
    enableCalls,
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    clientAndSDKContextRenderOptions,
    TestSDKContext,
} from "test-utils";

import { ElementCall } from "../../../models/Call";
import { CallStore } from "../../../stores/CallStore";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import PersistedElement from "../elements/PersistedElement";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { ElementCallAppTile } from "./ElementCallAppTile";
import { ElementCallInstance } from "./ElementCallInstance";

const { enabledSettings } = enableCalls();
enabledSettings.add("feature_element_call_react");

describe("ElementCallAppTile", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;
    let sdkContext: TestSDKContext;
    let call: ElementCall;
    let viewedRoomId: string | null;

    beforeEach(() => {
        ({ client, room } = setUpClientRoomAndStores());
        setupAsyncStoreWithClient(CallStore.instance, client);

        viewedRoomId = room.roomId;
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        sdkContext._RoomViewStore = { getRoomId: () => viewedRoomId } as any;

        ElementCall.create(room);
        const maybeCall = CallStore.instance.getCall(room.roomId);
        if (!(maybeCall instanceof ElementCall)) throw new Error("Failed to create call");
        call = maybeCall;
    });

    afterEach(async () => {
        cleanup(); // Unmount before we do any cleanup that might update the component
        // Let the tile's deferred (StrictMode-safe) teardown run before the next test starts
        await new Promise((r) => setTimeout(r, 5));
        call.destroy();
        cleanUpClientRoomAndStores(client, room);
        // Not restoreAllMocks: that would also undo enableCalls()' SettingsStore stub.
        vi.clearAllMocks();
    });

    const renderTile = async (props: Partial<React.ComponentProps<typeof ElementCallAppTile>> = {}): Promise<void> => {
        render(
            <ElementCallAppTile app={call.widget} room={room} {...props} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        await act(() => Promise.resolve()); // Let effects settle
    };

    it("renders the Element Call component in a persisted element with the call tile classes", async () => {
        await renderTile({ overlay: <div data-testid="overlay" /> });
        expect(await screen.findByText("Element Call (mock)")).toBeInTheDocument();
        expect(screen.getByText(new RegExp(room.roomId))).toBeInTheDocument();
        expect(screen.getByTestId("overlay")).toBeInTheDocument();
        expect(document.querySelector(".mx_AppTile .mx_AppTile_persistedWrapper")).not.toBeNull();
        expect(document.querySelector(".mx_AppTileBody.mx_AppTileBody--large.mx_AppTileBody--call")).not.toBeNull();
    });

    it("uses the mini classes and z-index in miniMode", async () => {
        await renderTile({ miniMode: true, fullWidth: true });
        await screen.findByText("Element Call (mock)");
        expect(document.querySelector(".mx_AppTile_mini")).not.toBeNull();
        expect(document.querySelector(".mx_AppTileBody--mini.mx_AppTileBody--call")).not.toBeNull();
    });

    it("renders nothing for a widget that is not the room's call", async () => {
        await renderTile({ app: { ...call.widget, id: "someOtherWidget" } });
        expect(screen.queryByText("Element Call (mock)")).not.toBeInTheDocument();
    });

    it("lets the call start once the component reports contentLoaded", async () => {
        await renderTile();
        await screen.findByText("Element Call (mock)");
        await expect(call.start({})).resolves.toBeNull();
    });

    it("passes the call's intent and configuration to the component", async () => {
        call.widgetGenerationParameters = { skipLobby: true };
        await renderTile();
        const shown = JSON.parse((await screen.findByLabelText("Effective configuration")).textContent!);
        expect(shown.intent).toBe("start_call");
        expect(shown.config).toMatchObject({ skipLobby: true, background: "solid", perParticipantE2EE: false });
    });

    it("docks while mounted and tears the call down on unmount when nothing keeps it alive", async () => {
        const dock = vi.spyOn(ActiveWidgetStore.instance, "dockWidget");
        const undock = vi.spyOn(ActiveWidgetStore.instance, "undockWidget");
        const destroyElement = vi.spyOn(PersistedElement, "destroyElement");
        const destroyPersistent = vi.spyOn(ActiveWidgetStore.instance, "destroyPersistentWidget");

        await renderTile();
        expect(dock).toHaveBeenCalledWith(call.widget.id, room.roomId);

        cleanup();
        expect(undock).toHaveBeenCalledWith(call.widget.id, room.roomId);
        // Teardown is deferred by a tick (StrictMode-safe)
        await waitFor(() => expect(destroyElement).toHaveBeenCalled());
        expect(destroyPersistent).toHaveBeenCalledWith(call.widget.id, room.roomId);
    });

    it("survives StrictMode's simulated unmount and remount", async () => {
        const destroyElement = vi.spyOn(PersistedElement, "destroyElement");
        render(
            <React.StrictMode>
                <ElementCallAppTile app={call.widget} room={room} />
            </React.StrictMode>,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(await screen.findByText("Element Call (mock)")).toBeInTheDocument();
        await act(() => new Promise((r) => setTimeout(r, 10)));
        expect(destroyElement).not.toHaveBeenCalled();
        expect(ActiveWidgetStore.instance.isDocked(call.widget.id, room.roomId)).toBe(true);
    });

    it("keeps the call alive on unmount while it is persistent", async () => {
        const destroyElement = vi.spyOn(PersistedElement, "destroyElement");
        await renderTile();
        ActiveWidgetStore.instance.setWidgetPersistence(call.widget.id, room.roomId, true);

        cleanup();
        await act(() => new Promise((r) => setTimeout(r, 10)));
        expect(destroyElement).not.toHaveBeenCalled();
        ActiveWidgetStore.instance.destroyPersistentWidget(call.widget.id, room.roomId);
    });

    it("connects the call when the component reports joined, and becomes persistent when asked", async () => {
        const setPersistence = vi.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence");
        const user = userEvent.setup();
        await renderTile();
        await screen.findByText("Element Call (mock)");

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        await waitFor(() => expect(call.connected).toBe(true));

        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(true)" }));
        await waitFor(() => expect(setPersistence).toHaveBeenCalledWith(call.widget.id, room.roomId, true));

        await user.click(screen.getByRole("button", { name: "notifyHungUp" }));
        await waitFor(() => expect(call.connected).toBe(false));
        ActiveWidgetStore.instance.destroyPersistentWidget(call.widget.id, room.roomId);
    });

    it("shows the same component to every tile, so moving between containers does not restart the call", async () => {
        await renderTile();
        await screen.findByText("Element Call (mock)");
        const contentLoadedReports = (): number =>
            screen.getByRole("list", { name: "HostBridge log" }).textContent!.split("→ contentLoaded").length - 1;
        // (Twice rather than once: PersistedElement renders in StrictMode, which replays mount effects)
        await waitFor(() => expect(contentLoadedReports()).toBeGreaterThan(0));
        await act(() => new Promise((r) => setTimeout(r, 10)));
        const reportsBefore = contentLoadedReports();
        const before = ElementCallInstance.get(call, client);

        // The call moves from the room view to the floating PiP: a different tile in a different container.
        // As in the app, the call is persistent by then (the PiP only shows persistent widgets), which is
        // what keeps it alive across the first tile's deferred teardown.
        ActiveWidgetStore.instance.setWidgetPersistence(call.widget.id, room.roomId, true);
        cleanup();
        await renderTile({ miniMode: true, fullWidth: true });
        await screen.findByText("Element Call (mock)");
        await act(() => new Promise((r) => setTimeout(r, 10)));

        expect(document.querySelector(".mx_AppTile_mini")).not.toBeNull();
        expect(ElementCallInstance.get(call, client)).toBe(before);
        // The mock reports contentLoaded again whenever it is handed a new hostBridge
        expect(contentLoadedReports()).toBe(reportsBefore);
        ActiveWidgetStore.instance.destroyPersistentWidget(call.widget.id, room.roomId);
    });

    it("hangs up through the component when Element Web disconnects", async () => {
        const user = userEvent.setup();
        await renderTile();
        await screen.findByText("Element Call (mock)");
        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        await waitFor(() => expect(call.connected).toBe(true));

        await act(() => call.disconnect());
        expect(call.connected).toBe(false);
        await waitFor(() => expect(screen.getByRole("list", { name: "HostBridge log" })).toHaveTextContent("← hangUp"));
    });

    describe("leaving the room", () => {
        beforeEach(async () => {
            await renderTile();
            await screen.findByText("Element Call (mock)");
            ActiveWidgetStore.instance.setWidgetPersistence(call.widget.id, room.roomId, true);
        });

        it("just cancels persistence when still viewing the room", () => {
            const destroyElement = vi.spyOn(PersistedElement, "destroyElement");
            act(() => {
                client.emit(RoomEvent.MyMembership, room, KnownMembership.Leave, KnownMembership.Join);
            });
            expect(ActiveWidgetStore.instance.getWidgetPersistence(call.widget.id, room.roomId)).toBe(false);
            expect(destroyElement).not.toHaveBeenCalled();
        });

        it("ends the call entirely when not viewing the room", () => {
            viewedRoomId = "!other:example.org";
            const destroyElement = vi.spyOn(PersistedElement, "destroyElement");
            act(() => {
                dis.dispatch({ action: Action.AfterLeaveRoom, room_id: room.roomId }, true);
            });
            expect(ActiveWidgetStore.instance.getWidgetPersistence(call.widget.id, room.roomId)).toBe(false);
            expect(destroyElement).toHaveBeenCalled();
        });
    });
});
