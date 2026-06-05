/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventEmitter } from "events";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { MJitsiWidgetEventViewModel } from "../../../src/viewmodels/room/timeline/event-tile/MJitsiWidgetEventViewModel";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import { mkEvent, stubClient } from "../../test-utils";
import type WidgetStore from "../../../src/stores/WidgetStore";
import type { IApp } from "../../../src/stores/WidgetStore";

describe("MJitsiWidgetEventViewModel", () => {
    const roomId = "!room:example.com";
    const widgetId = "jitsi";
    let cli: MatrixClient;
    let room: Room;
    let widget: IApp;
    let widgetStore: WidgetStore & EventEmitter;
    let widgetLayoutStore: WidgetLayoutStore & EventEmitter;

    const createEvent = (content: { url?: string }, prevContent: { url?: string } = {}) =>
        mkEvent({
            event: true,
            room: roomId,
            user: "@alice:example.com",
            skey: widgetId,
            type: "im.vector.modular.widgets",
            content,
            prev_content: prevContent,
        });

    const createVm = (
        props: Partial<ConstructorParameters<typeof MJitsiWidgetEventViewModel>[0]> = {},
    ): MJitsiWidgetEventViewModel =>
        new MJitsiWidgetEventViewModel({
            cli,
            mxEvent: createEvent({ url: "https://jitsi.example.com/room" }),
            widgetStore,
            widgetLayoutStore,
            ...props,
        });

    beforeEach(() => {
        cli = stubClient();
        room = cli.getRoom(roomId)!;
        widget = {
            id: widgetId,
            roomId,
            type: "m.jitsi",
        } as IApp;
        widgetStore = Object.assign(new EventEmitter(), {
            getRoom: jest.fn().mockReturnValue({ widgets: [widget] }),
        }) as unknown as WidgetStore & EventEmitter;
        widgetLayoutStore = Object.assign(new EventEmitter(), {
            isInContainer: jest.fn().mockReturnValue(false),
        }) as unknown as WidgetLayoutStore & EventEmitter;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders a started Jitsi event with the top join prompt", () => {
        const vm = createVm();

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            title: "Video conference started by @alice:example.com",
            subtitle: "Join the conference at the top of this room",
        });
    });

    it("uses the right-panel join prompt when the widget is in the right container", () => {
        jest.mocked(widgetLayoutStore.isInContainer).mockReturnValue(true);

        const vm = createVm();

        expect(vm.getSnapshot().subtitle).toBe("Join the conference from the room information card on the right");
    });

    it("omits the join prompt when the widget no longer exists", () => {
        jest.mocked(widgetStore.getRoom).mockReturnValue({ widgets: [] });

        const vm = createVm();

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            title: "Video conference started by @alice:example.com",
            subtitle: null,
        });
    });

    it("renders an updated Jitsi event", () => {
        const vm = createVm({
            mxEvent: createEvent({ url: "https://jitsi.example.com/room" }, { url: "https://old.example.com/room" }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            title: "Video conference updated by @alice:example.com",
            subtitle: "Join the conference at the top of this room",
        });
    });

    it("renders an ended Jitsi event without a join prompt", () => {
        const vm = createVm({
            mxEvent: createEvent({}, { url: "https://old.example.com/room" }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            title: "Video conference ended by @alice:example.com",
            subtitle: null,
        });
    });

    it("hides the event when the room is unavailable", () => {
        jest.spyOn(cli, "getRoom").mockReturnValue(null);

        const vm = createVm();

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: false,
            title: "",
            subtitle: null,
        });
    });

    it("updates the snapshot when the event changes", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(createEvent({ url: "https://jitsi.example.com/room" }, { url: "https://old.example.com/room" }));

        expect(vm.getSnapshot().title).toBe("Video conference updated by @alice:example.com");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit updates when setEvent receives the current event", () => {
        const mxEvent = createEvent({ url: "https://jitsi.example.com/room" });
        const listener = jest.fn();
        const vm = createVm({ mxEvent });

        vm.subscribe(listener);
        vm.setEvent(mxEvent);

        expect(listener).not.toHaveBeenCalled();
    });

    it("updates when widget stores emit for the room", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);
        jest.mocked(widgetLayoutStore.isInContainer).mockReturnValue(true);

        widgetStore.emit(UPDATE_EVENT, roomId);

        expect(vm.getSnapshot().subtitle).toBe("Join the conference from the room information card on the right");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates when the widget layout store emits for the room", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);
        jest.mocked(widgetLayoutStore.isInContainer).mockReturnValue(true);

        widgetLayoutStore.emit(WidgetLayoutStore.emissionForRoom(room));

        expect(vm.getSnapshot().subtitle).toBe("Join the conference from the room information card on the right");
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
