/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import * as MediaEventHelperModule from "../../../../../src/utils/MediaEventHelper";
import NavigableImageViewDialog from "../../../../../src/components/views/messages/NavigableImageViewDialog";

// ---- Mock ImageView ----
const mockImageView = jest.fn();

jest.mock("../../../../../src/components/views/elements/ImageView", () => {
    return function MockImageView(props: any) {
        mockImageView(props);
        return (
            <div>
                <div data-testid="name">{props.name}</div>
                <div data-testid="src">{props.src}</div>
                <div data-testid="hasPrev">{String(Boolean(props.hasPrev))}</div>
                <div data-testid="hasNext">{String(Boolean(props.hasNext))}</div>

                <button onClick={() => props.onPrev?.()}>prev</button>
                <button onClick={() => props.onNext?.()}>next</button>
            </div>
        );
    };
});

// ---- Mock MediaEventHelper ----
jest.mock("../../../../../src/utils/MediaEventHelper", () => {
    // State lives inside the mock module (allowed by Jest)
    let sourceUrlValue: Promise<string | null> = Promise.resolve("blob:mock-src");

    class MediaEventHelper {
        public sourceUrl = { value: sourceUrlValue };
        public thumbnailUrl = { value: Promise.resolve(null) };
        public destroy = jest.fn();
        public constructor(_ev: any) {}
    }

    return {
        MediaEventHelper,
        // Test-only helpers to control the promises
        setSourceUrlValue: (p: Promise<string | null>) => {
            sourceUrlValue = p;
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
        (MediaEventHelperModule as any).setSourceUrlValue(Promise.resolve("blob:mock-src"));
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

        let resolveSource!: (v: string | null) => void;
        const sourcePromise = new Promise<string | null>((res) => {
            resolveSource = res;
        });
        (MediaEventHelperModule as any).setSourceUrlValue(sourcePromise);

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        // src should initially be the provided initialSrc
        expect(await screen.findByTestId("src")).toHaveTextContent("blob:initial-src");

        // now resolve MediaEventHelper sourceUrl then ImageView src should update
        resolveSource("blob:mock-src");
        await waitFor(() => {
            expect(screen.getByTestId("src")).toHaveTextContent("blob:mock-src");
        });

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true");

        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("second");
        expect(screen.getByTestId("hasNext")).toHaveTextContent("false");
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true");
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

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await userEvent.click(screen.getByText("prev"));

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });

        await waitFor(() => {
            expect(screen.getByTestId("hasPrev")).toHaveTextContent("false");
        });
    });

    it("paginates backwards and navigates to an earlier image when found", async () => {
        const roomId = "!room:server";
        const ev0 = mkImageEvent("$img0", roomId, "earlier");
        const ev1 = mkImageEvent("$img1", roomId, "first");

        // timeline starts with only the initial event
        const events: any[] = [ev1];
        const timeline = { getEvents: () => events };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        // When paginating, insert an earlier image at the start and report success
        mockClient.paginateEventTimeline.mockImplementation(async () => {
            events.unshift(ev0);
            return true;
        });

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        // Click prev while at index 0: should paginate and then navigate to ev0
        await userEvent.click(screen.getByText("prev"));

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });

        // After pagination inserts ev0, dialog should navigate to it
        expect(await screen.findByTestId("name")).toHaveTextContent("earlier");
    });
});
