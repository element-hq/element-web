/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { type MockedObject } from "jest-mock";
import { useRef } from "react";

import { mkRoom, stubClient } from "../../test-utils";
import { WidgetPipViewModel } from "../../../src/viewmodels/room/WidgetPipViewModel";
import WidgetStore, { type IApp } from "../../../src/stores/WidgetStore";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { Container, WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import { CallStore, CallStoreEvent } from "../../../src/stores/CallStore";
import { type Call } from "../../../src/models/Call";

const userId = "@example:example.org";
const widgetId = "test-widget-id";

type BackClickEvent = Parameters<WidgetPipViewModel["onBackClick"]>[0];

const createBackClickEvent = (): BackClickEvent =>
    ({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
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
        jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);

        vm = new WidgetPipViewModel({
            room,
            widgetId,
            onStartMoving: () => {},
            movePersistedElement: useRef(null),
        });
    });

    afterEach(() => {
        vm.dispose();
        jest.restoreAllMocks();
    });

    it("updates room name", () => {
        room.name = "New Room Name";
        room.emit(RoomEvent.Name, room);
        expect(vm.getSnapshot().roomName).toBe("New Room Name");
    });

    it("updates onBackClick if call changes", () => {
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});

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
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const moveSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer").mockImplementation(() => {});

        vm.setViewingRoom(true);
        vm.onBackClick(createBackClickEvent());
        expect(moveSpy).toHaveBeenCalledWith(room, widget, Container.Center);

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
