import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NavigableImageViewDialog from "../../../../../src/components/views/messages/NavigableImageViewDialog";

// ---- Mock ImageView ----
const mockImageView = jest.fn();

jest.mock("../../../../../src/components/views/elements/ImageView", () => {
    return function MockImageView(props: any) {
        mockImageView(props);
        return (
            <div>
                <div data-testid="name">{props.name}</div>
                <div data-testid="hasPrev">{String(Boolean(props.hasPrev))}</div>
                <div data-testid="hasNext">{String(Boolean(props.hasNext))}</div>

                <button onClick={() => props.onPrev?.()} >
                    prev
                </button>
                <button onClick={() => props.onNext?.()}>
                    next
                </button>
            </div>
        );
    };
});

// ---- Mock MediaEventHelper ----
jest.mock("../../../../../src/utils/MediaEventHelper", () => {
    return {
        MediaEventHelper: class {
            public sourceUrl = { value: Promise.resolve("blob:mock-src") };
            public thumbnailUrl = { value: Promise.resolve(null) };
            public destroy = jest.fn();
            public constructor(_ev: any) {}
        },
    };
});

// ---- Mock MatrixClientPeg.safeGet() ----
const mockClient = {
    getRoom: jest.fn(),
    getEventTimeline: jest.fn(),
    paginateEventTimeline: jest.fn(),
};

jest.mock("../../../../../src/MatrixClientPeg", () => {
    return {
        MatrixClientPeg: {
            safeGet: () => mockClient,
        },
    };
});

// Helpers to create minimal MatrixEvent-like objects
function mkImageEvent(id: string, roomId: string, body: string) {
    return {
        getId: () => id,
        getRoomId: () => roomId,
        isRedacted: () => false,
        getType: () => "m.room.message",
        getContent: () => ({ msgtype: "m.image", body }),
    } as any;
}

describe("NavigableImageViewDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders and navigates between images in the same timeline", async () => {
        const roomId = "!room:server";
        const ev1 = mkImageEvent("$img1", roomId, "first");
        const ev2 = mkImageEvent("$img2", roomId, "second");

        const timeline = { getEvents: () => [ev1, ev2] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        render(<NavigableImageViewDialog initialEvent={ev1} onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true");

        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("second");
        expect(screen.getByTestId("hasNext")).toHaveTextContent("false");
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true")
        await userEvent.click(screen.getByText("prev"));
        expect(await screen.findByTestId("name")).toHaveTextContent("first");
    });

    it("attempts pagination when navigating prev at the start of the loaded image list", async () => {
        const roomId = "!room:server";
        const ev1 = mkImageEvent("$img1", roomId, "first");

        const timeline = { getEvents: () => [ev1] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);
        mockClient.paginateEventTimeline.mockResolvedValue(false);

        render(<NavigableImageViewDialog initialEvent={ev1} onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await userEvent.click(screen.getByText("prev"));

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(
          timeline,
          { backwards: true, limit: 50 }
        );

        await waitFor(() => {
            expect(screen.getByTestId("hasPrev")).toHaveTextContent("false");
        });
    });
});
