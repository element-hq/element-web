/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { Direction, EventType, RoomEvent, TimelineWindow } from "matrix-js-sdk/src/matrix";

import { flushPromises, mkEvent } from "../../test-utils";
import { TimelinePanelPresenter } from "../../../src/components/views/rooms/timeline/Timeline";
import { TimelinePanelViewModel } from "../../../src/viewmodels/room/timeline/TimelinePanelViewModel";

jest.mock("matrix-js-sdk/src/matrix", () => {
    const actual = jest.requireActual("matrix-js-sdk/src/matrix");
    return {
        ...actual,
        TimelineWindow: jest.fn(),
    };
});

jest.mock("../../../src/components/views/rooms/timeline/Timeline", () => ({
    TimelinePanelPresenter: jest.fn(),
}));

describe("TimelinePanelViewModel", () => {
    const unfilteredTimelineSet = {};
    const liveTimeline = {
        getTimelineSet: jest.fn(() => unfilteredTimelineSet),
    };
    const room = {
        roomId: "!room:example.org",
        getUnfilteredTimelineSet: jest.fn(() => unfilteredTimelineSet),
        on: jest.fn(),
        off: jest.fn(),
    } as any;
    const client = {} as any;

    const eventA = mkEvent({
        id: "$eventA",
        type: EventType.RoomMessage,
        room: room.roomId,
        user: "@alice:example.org",
        content: { body: "A", msgtype: "m.text" },
        ts: new Date("2026-04-08T08:00:00.000Z").getTime(),
        event: true,
    });

    let presenterInstance: {
        buildItems: jest.Mock;
        dispose: jest.Mock;
    };
    let timelineWindowInstance: {
        load: jest.Mock;
        paginate: jest.Mock;
        getEvents: jest.Mock;
        canPaginate: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        liveTimeline.getTimelineSet.mockReturnValue(unfilteredTimelineSet);

        presenterInstance = {
            buildItems: jest.fn(() => [{ key: "built", kind: "event" }]),
            dispose: jest.fn(),
        };
        mocked(TimelinePanelPresenter).mockImplementation(() => presenterInstance as any);

        timelineWindowInstance = {
            load: jest.fn().mockResolvedValue(undefined),
            paginate: jest.fn().mockResolvedValue(false),
            getEvents: jest.fn(() => [eventA]),
            canPaginate: jest.fn(() => false),
        };
        mocked(TimelineWindow).mockImplementation(() => timelineWindowInstance as any);
    });

    function createStartedViewModel(initialEventId?: string): TimelinePanelViewModel {
        const vm = new TimelinePanelViewModel(initialEventId ? { client, room, initialEventId } : { client, room });
        vm.start();
        return vm;
    }

    it("delegates item building to the presenter on load", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        expect(TimelinePanelPresenter).toHaveBeenCalledWith({
            room,
        });
        expect(TimelineWindow).toHaveBeenCalledWith(client, room.getUnfilteredTimelineSet(), {
            windowLimit: 200,
        });
        expect(timelineWindowInstance.load).toHaveBeenCalledWith(undefined, 40);
        expect(presenterInstance.buildItems).toHaveBeenCalledWith([eventA], false);
        expect(vm.getSnapshot().items).toEqual([{ key: "built", kind: "event" }]);
        expect(vm.getSnapshot().canPaginateBackward).toBe(false);
        expect(vm.getSnapshot().canPaginateForward).toBe(false);
        expect(room.on).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    });

    it("stores an anchor after loading a specific event", async () => {
        const vm = createStartedViewModel("$anchor");
        await flushPromises();

        expect(timelineWindowInstance.load).toHaveBeenCalledWith("$anchor", 40);
        expect(vm.getSnapshot().isAtLiveEdge).toBe(false);
        expect(vm.getSnapshot().scrollTarget).toEqual({
            targetKey: "$anchor",
            position: "bottom",
            highlight: undefined,
        });
    });

    it("updates items when backward pagination prepends history", async () => {
        timelineWindowInstance.canPaginate.mockImplementation(
            (direction: Direction) => direction === Direction.Backward,
        );
        presenterInstance.buildItems.mockReturnValueOnce([{ key: "one", kind: "event" }]).mockReturnValueOnce([
            { key: "zero", kind: "event" },
            { key: "one", kind: "event" },
        ]);

        const vm = createStartedViewModel();
        await flushPromises();

        vm.onRequestMoreItems("backward");
        await flushPromises();

        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Backward, 20);
        expect(vm.getSnapshot().items).toEqual([
            { key: "zero", kind: "event" },
            { key: "one", kind: "event" },
        ]);
        expect(vm.getSnapshot().canPaginateBackward).toBe(true);
        expect(vm.getSnapshot().canPaginateForward).toBe(false);
    });

    it("ignores a second pagination request while the same direction is already loading", async () => {
        timelineWindowInstance.canPaginate.mockImplementation(
            (direction: Direction) => direction === Direction.Backward,
        );

        let resolvePagination: (value: boolean) => void;
        const paginationPromise = new Promise<boolean>((resolve) => {
            resolvePagination = resolve;
        });
        timelineWindowInstance.paginate.mockReturnValue(paginationPromise);

        const vm = createStartedViewModel();
        await flushPromises();

        vm.onRequestMoreItems("backward");
        vm.onRequestMoreItems("backward");

        expect(timelineWindowInstance.paginate).toHaveBeenCalledTimes(1);
        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Backward, 20);
        expect(vm.getSnapshot().backwardPagination).toBe("loading");

        resolvePagination!(false);
        await flushPromises();

        expect(vm.getSnapshot().backwardPagination).toBe("idle");
    });

    it("marks pagination as exhausted when the timeline can no longer paginate backward", async () => {
        timelineWindowInstance.canPaginate.mockImplementationOnce(() => true).mockImplementation(() => false);

        const vm = createStartedViewModel();
        await flushPromises();

        vm.onRequestMoreItems("backward");
        await flushPromises();

        expect(vm.getSnapshot().canPaginateBackward).toBe(false);
        expect(vm.getSnapshot().backwardPagination).toBe("idle");
    });

    it("does not auto-extend the live window while scrolled up", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        vm.onIsAtLiveEdgeChanged(false);
        room.on.mock.calls[0]?.[1](eventA, room, false, false, { timeline: liveTimeline, liveEvent: true });

        await flushPromises();

        expect(timelineWindowInstance.paginate).not.toHaveBeenCalledWith(Direction.Forward, 1, false);
        expect(vm.getSnapshot().canPaginateForward).toBe(true);
    });

    it("extends the live window without a network request when stuck at bottom", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        room.on.mock.calls[0]?.[1](eventA, room, false, false, { timeline: liveTimeline, liveEvent: true });
        await flushPromises();

        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Forward, 1, false);
        expect(vm.getSnapshot().forwardPagination).toBe("idle");
    });

    it("ignores a second live-end extension while forward pagination is already loading", async () => {
        let resolvePagination: (value: boolean) => void;
        const paginationPromise = new Promise<boolean>((resolve) => {
            resolvePagination = resolve;
        });
        timelineWindowInstance.paginate.mockReturnValue(paginationPromise);

        const vm = createStartedViewModel();
        await flushPromises();

        room.on.mock.calls[0]?.[1](eventA, room, false, false, { timeline: liveTimeline, liveEvent: true });
        room.on.mock.calls[0]?.[1](eventA, room, false, false, { timeline: liveTimeline, liveEvent: true });

        expect(timelineWindowInstance.paginate).toHaveBeenCalledTimes(1);
        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Forward, 1, false);
        expect(vm.getSnapshot().forwardPagination).toBe("loading");

        resolvePagination!(false);
        await flushPromises();

        expect(vm.getSnapshot().forwardPagination).toBe("idle");
    });

    it("marks forward pagination as error when live-end extension fails", async () => {
        timelineWindowInstance.paginate.mockRejectedValueOnce(new Error("boom"));

        const vm = createStartedViewModel();
        await flushPromises();

        room.on.mock.calls[0]?.[1](eventA, room, false, false, { timeline: liveTimeline, liveEvent: true });
        await flushPromises();

        expect(vm.getSnapshot().forwardPagination).toBe("error");
    });

    it("ignores pagination-driven timeline updates", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        room.on.mock.calls[0]?.[1](eventA, room, true, false, { timeline: liveTimeline, liveEvent: false });
        await flushPromises();

        expect(timelineWindowInstance.paginate).not.toHaveBeenCalledWith(Direction.Forward, 1, false);
        expect(vm.getSnapshot().canPaginateForward).toBe(false);
    });

    it("refuses public forward pagination until initial fill is marked complete", async () => {
        timelineWindowInstance.canPaginate.mockImplementation(
            (direction: Direction) => direction === Direction.Forward,
        );

        const vm = createStartedViewModel();
        await flushPromises();

        vm.onRequestMoreItems("forward");
        expect(timelineWindowInstance.paginate).not.toHaveBeenCalledWith(Direction.Forward, 20);

        vm.onInitialFillCompleted();
        vm.onRequestMoreItems("forward");
        await flushPromises();

        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Forward, 20);
    });

    it("tracks the latest visible range without triggering pagination", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        vm.onVisibleRangeChanged({ startIndex: 0, endIndex: 0 });
        await flushPromises();

        expect(vm.visibleRange).toEqual({ startIndex: 0, endIndex: 0 });
        expect(timelineWindowInstance.paginate).not.toHaveBeenCalledWith(Direction.Backward, 20);
    });

    it("disposes the presenter and unsubscribes from room updates", async () => {
        const vm = createStartedViewModel();
        await flushPromises();

        vm.dispose();

        expect(presenterInstance.dispose).toHaveBeenCalled();
        expect(room.off).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    });

    it("ignores load completion after disposal", async () => {
        let resolveLoad: () => void;
        timelineWindowInstance.load.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveLoad = resolve;
            }),
        );

        const vm = createStartedViewModel();

        expect(vm.getSnapshot().backwardPagination).toBe("loading");
        vm.dispose();
        resolveLoad!();
        await flushPromises();

        expect(vm.getSnapshot().items).toEqual([]);
        expect(vm.getSnapshot().backwardPagination).toBe("loading");
        expect(vm.getSnapshot().forwardPagination).toBe("loading");
        expect(presenterInstance.buildItems).not.toHaveBeenCalled();
    });

    it("ignores pagination completion after disposal", async () => {
        timelineWindowInstance.canPaginate.mockImplementation(
            (direction: Direction) => direction === Direction.Backward,
        );

        let resolvePagination: (value: boolean) => void;
        timelineWindowInstance.paginate.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolvePagination = resolve;
            }),
        );

        const vm = createStartedViewModel();
        await flushPromises();

        vm.onRequestMoreItems("backward");
        expect(vm.getSnapshot().backwardPagination).toBe("loading");

        vm.dispose();
        resolvePagination!(true);
        await flushPromises();

        expect(vm.getSnapshot().backwardPagination).toBe("loading");
    });
});
