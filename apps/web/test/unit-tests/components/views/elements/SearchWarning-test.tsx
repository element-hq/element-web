/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render } from "jest-matrix-react";
import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../../../../src/SdkConfig";
import SearchWarning, { WarningKind } from "../../../../../src/components/views/elements/SearchWarning";
import EventIndexPeg from "../../../../../src/indexing/EventIndexPeg";
import { type default as EventIndex } from "../../../../../src/indexing/EventIndex";
import { SearchScope } from "../../../../../src/Searching";

const SEARCHED_ROOM = "!searched:example.org";
const OTHER_ROOM = "!other:example.org";
const PARTIAL_WARNING = "Results may be incomplete because your search index is still being built.";

/**
 * A minimal fake EventIndex exposing only the surface that SearchWarning consumes:
 * `crawlingRooms()` (the rooms with outstanding crawler checkpoints) and the `changedCheckpoint`
 * emitter.
 */
class FakeEventIndex {
    private listeners = new Map<string, Set<(...args: any[]) => void>>();

    public constructor(private crawling: string[] = []) {}

    public crawlingRooms(): { crawlingRooms: Set<string>; totalRooms: Set<string> } {
        return { crawlingRooms: new Set(this.crawling), totalRooms: new Set(this.crawling) };
    }

    public on(event: string, listener: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener);
    }

    public removeListener(event: string, listener: (...args: any[]) => void): void {
        this.listeners.get(event)?.delete(listener);
    }

    /**
     * Test helper: simulate the crawler advancing (or finishing, when `crawling` is empty).
     *
     * The real index emits only the globally-current room, which cannot answer a per-room
     * question, so `currentRoom` is passed through purely to prove consumers ignore it.
     */
    public emitChangedCheckpoint(crawling: string[], currentRoom: Room | null = null): void {
        this.crawling = crawling;
        this.listeners.get("changedCheckpoint")?.forEach((listener) => listener(currentRoom));
    }
}

describe("<SearchWarning />", () => {
    afterEach(() => {
        EventIndexPeg.index = null;
        EventIndexPeg.error = undefined;
    });

    describe("with desktop builds available", () => {
        beforeEach(() => {
            EventIndexPeg.index = null;
            SdkConfig.put({
                brand: "Element",
                desktop_builds: {
                    available: true,
                    logo: "https://logo",
                    url: "https://url",
                },
            });
        });

        it("renders with a logo by default", () => {
            const { asFragment, getByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />,
            );
            expect(getByRole("presentation")).toHaveAttribute("src", "https://logo");
            expect(asFragment()).toMatchSnapshot();
        });

        it("renders without a logo when showLogo=false", () => {
            const { asFragment, queryByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} showLogo={false} />,
            );

            expect(queryByRole("img")).not.toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });

    describe("with the event index present", () => {
        const setIndex = (index: FakeEventIndex): void => {
            EventIndexPeg.index = index as unknown as EventIndex;
        };

        it("warns a room-scoped search while the searched room is still being crawled", () => {
            setIndex(new FakeEventIndex([SEARCHED_ROOM]));

            const { queryByText, queryByRole } = render(
                <SearchWarning
                    isRoomEncrypted={true}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={SEARCHED_ROOM}
                />,
            );

            expect(queryByText(PARTIAL_WARNING)).toBeInTheDocument();
            // The notice appears dynamically while the panel is open, so it must be a live region (#32253).
            expect(queryByRole("status")).toBeInTheDocument();
        });

        it("does not warn a room-scoped search when only an unrelated room is still being crawled", () => {
            setIndex(new FakeEventIndex([OTHER_ROOM]));

            const { container } = render(
                <SearchWarning
                    isRoomEncrypted={true}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={SEARCHED_ROOM}
                />,
            );

            expect(container).toBeEmptyDOMElement();
        });

        it("warns an all-rooms search while any room is still being crawled", () => {
            setIndex(new FakeEventIndex([OTHER_ROOM]));

            const { queryByText } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} scope={SearchScope.All} />,
            );

            expect(queryByText(PARTIAL_WARNING)).toBeInTheDocument();
        });

        it("falls back to the global check when the searched room is not yet known", () => {
            // RoomView can render before a room alias has resolved to an id.
            setIndex(new FakeEventIndex([OTHER_ROOM]));

            const { queryByText } = render(
                <SearchWarning
                    isRoomEncrypted={true}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={undefined}
                />,
            );

            expect(queryByText(PARTIAL_WARNING)).toBeInTheDocument();
        });

        it("renders nothing once the index has finished crawling", () => {
            setIndex(new FakeEventIndex([]));

            const { container } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} scope={SearchScope.All} />,
            );

            expect(container).toBeEmptyDOMElement();
        });

        it("does not warn for the Files kind even while crawling", () => {
            setIndex(new FakeEventIndex([SEARCHED_ROOM]));

            const { container } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Files} />);

            expect(container).toBeEmptyDOMElement();
        });

        it("clears the warning when the searched room's checkpoint drains", () => {
            const index = new FakeEventIndex([SEARCHED_ROOM]);
            setIndex(index);

            const { queryByText } = render(
                <SearchWarning
                    isRoomEncrypted={true}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={SEARCHED_ROOM}
                />,
            );

            expect(queryByText(PARTIAL_WARNING)).toBeInTheDocument();

            act(() => {
                index.emitChangedCheckpoint([]);
            });

            expect(queryByText(PARTIAL_WARNING)).not.toBeInTheDocument();
        });

        it("keeps warning when the crawler moves to another room but the searched room is still queued", () => {
            const index = new FakeEventIndex([SEARCHED_ROOM, OTHER_ROOM]);
            setIndex(index);

            const { queryByText } = render(
                <SearchWarning
                    isRoomEncrypted={true}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={SEARCHED_ROOM}
                />,
            );

            // The event payload names a different room; the searched room is still outstanding, so
            // the warning must survive. This fails if the handler trusts the payload.
            act(() => {
                index.emitChangedCheckpoint([SEARCHED_ROOM], { roomId: OTHER_ROOM } as Room);
            });

            expect(queryByText(PARTIAL_WARNING)).toBeInTheDocument();
        });

        it("renders nothing when the room is not encrypted even while crawling", () => {
            setIndex(new FakeEventIndex([SEARCHED_ROOM]));

            const { container } = render(
                <SearchWarning
                    isRoomEncrypted={false}
                    kind={WarningKind.Search}
                    scope={SearchScope.Room}
                    roomId={SEARCHED_ROOM}
                />,
            );

            expect(container).toBeEmptyDOMElement();
        });
    });

    describe("with no event index (web build)", () => {
        beforeEach(() => {
            EventIndexPeg.index = null;
            EventIndexPeg.error = undefined;
            SdkConfig.put({
                brand: "Element",
                desktop_builds: {
                    available: true,
                    logo: "https://logo",
                    url: "https://url",
                },
            });
        });

        it("still renders the desktop/enable-search warning", () => {
            const { container } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />);

            expect(container.querySelector(".mx_SearchWarning")).toBeInTheDocument();
            expect(container.textContent).toContain("to search encrypted messages");
            // It is the desktop/enable-search affordance, not the partial-index notice.
            expect(container.textContent).not.toContain("your search index is still being built");
        });
    });
});
