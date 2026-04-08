/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { Direction, EventType, RoomEvent, TimelineWindow } from "matrix-js-sdk/src/matrix";

import { flushPromises, mkEvent } from "../../test-utils";
import { TimelinePanelPresenter } from "../../../src/viewmodels/room/timeline/TimelinePanelPresenter";
import { TimelinePanelViewModel } from "../../../src/viewmodels/room/timeline/TimelinePanelViewModel";

jest.mock("matrix-js-sdk/src/matrix", () => {
    const actual = jest.requireActual("matrix-js-sdk/src/matrix");
    return {
        ...actual,
        TimelineWindow: jest.fn(),
    };
});

jest.mock("../../../src/viewmodels/room/timeline/TimelinePanelPresenter", () => ({
    TimelinePanelPresenter: jest.fn(),
}));

describe("TimelinePanelViewModel", () => {
    const room = {
        roomId: "!room:example.org",
        getUnfilteredTimelineSet: jest.fn(() => ({})),
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

    it("delegates item building to the presenter on load", async () => {
        const vm = new TimelinePanelViewModel({ client, room });
        await flushPromises();

        expect(TimelinePanelPresenter).toHaveBeenCalledWith({
            client,
            room,
            canPaginateBackward: expect.any(Function),
        });
        expect(timelineWindowInstance.load).toHaveBeenCalledWith(undefined, 30);
        expect(presenterInstance.buildItems).toHaveBeenCalledWith([eventA]);
        expect(vm.getSnapshot().items).toEqual([{ key: "built", kind: "event" }]);
        expect(room.on).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    });

    it("updates firstItemIndex when backward pagination prepends items", async () => {
        timelineWindowInstance.canPaginate.mockImplementation(
            (direction: Direction) => direction === Direction.Backward,
        );
        presenterInstance.buildItems.mockReturnValueOnce([{ key: "one", kind: "event" }]).mockReturnValueOnce([
            { key: "zero", kind: "event" },
            { key: "one", kind: "event" },
        ]);

        const vm = new TimelinePanelViewModel({ client, room });
        await flushPromises();

        expect(vm.getFirstItemIndex()).toBe(100_000);

        vm.paginate("backward");
        await flushPromises();

        expect(timelineWindowInstance.paginate).toHaveBeenCalledWith(Direction.Backward, 20);
        expect(vm.getFirstItemIndex()).toBe(99_999);
        expect(vm.getSnapshot().items).toEqual([
            { key: "zero", kind: "event" },
            { key: "one", kind: "event" },
        ]);
    });

    it("disposes the presenter and unsubscribes from room updates", async () => {
        const vm = new TimelinePanelViewModel({ client, room });
        await flushPromises();

        vm.dispose();

        expect(presenterInstance.dispose).toHaveBeenCalled();
        expect(room.off).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    });
});
