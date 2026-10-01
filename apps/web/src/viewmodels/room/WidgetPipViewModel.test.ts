/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { type MatrixClient, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import { createRef } from "react";
import { mkRoom, stubClient } from "test-utils";

import { WidgetPipViewModel } from "./WidgetPipViewModel";
import WidgetStore, { type IApp } from "../../stores/WidgetStore";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { type Call } from "../../models/Call";

const userId = "@example:example.org";
const widgetId = "test-widget-id";

type BackClickEvent = Parameters<WidgetPipViewModel["onBackClick"]>[0];

const createBackClickEvent = (): BackClickEvent =>
    ({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    }) as unknown as BackClickEvent;

describe("WidgetPipViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let vm: WidgetPipViewModel;
    let room: MockedObject<Room>;
    let widget: IApp;

    beforeEach(() => {
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkRoom(client, "!example");
        widget = {
            id: widgetId,
            roomId: room.roomId,
            creatorUserId: userId,
            type: "m.custom",
            name: "Test Widget",
            data: {},
        } as unknown as IApp;
        vi.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);

        vm = new WidgetPipViewModel({
            room,
            widgetId,
            onStartMoving: () => {},
            movePersistedElement: createRef(),
        });
    });

    afterEach(() => {
        vm.dispose();
        vi.restoreAllMocks();
    });

    it("updates room name", () => {
        room.name = "New Room Name";
        room.emit(RoomEvent.Name, room);
        expect(vm.getSnapshot().roomName).toBe("New Room Name");
    });

    it("updates onBackClick if call changes", () => {
        const dispatchSpy = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});

        vm.onBackClick(createBackClickEvent());
        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "WebFloatingCallWindow",
        });
        dispatchSpy.mockClear();

        const call = { widget: { id: widgetId } } as unknown as Call;
        CallStore.instance.emit(CallStoreEvent.Call, call, room.roomId);

        vm.onBackClick(createBackClickEvent());
        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
            metricsTrigger: "WebFloatingCallWindow",
        });
    });

    it("updates onBackClick if viewingRoom changes", () => {
        const dispatchSpy = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const moveSpy = vi.spyOn(WidgetLayoutStore.instance, "moveToContainer").mockImplementation(() => {});

        vm.setViewingRoom(true);
        vm.onBackClick(createBackClickEvent());
        expect(moveSpy).toHaveBeenCalledWith(room, widget, "center");

        moveSpy.mockClear();
        vm.setViewingRoom(false);
        vm.onBackClick(createBackClickEvent());
        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "WebFloatingCallWindow",
        });
        expect(moveSpy).not.toHaveBeenCalled();
    });
});
