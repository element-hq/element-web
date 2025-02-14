/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import {
    Room,
    type MatrixClient,
    type IEvent,
    MatrixEvent,
    EventType,
    SearchResult,
    type ISearchResults,
} from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import { RoomSearchView } from "../../../../src/components/structures/RoomSearchView";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { stubClient } from "../../../test-utils";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { searchPagination, SearchScope } from "../../../../src/Searching";

jest.mock("../../../../src/Searching", () => ({
    searchPagination: jest.fn(),
    SearchScope: jest.requireActual("../../../../src/Searching").SearchScope,
}));

describe("<RoomSearchView/>", () => {
    const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
    const resizeNotifier = new ResizeNotifier();
    let client: MatrixClient;
    let room: Room;

    beforeEach(async () => {
        stubClient();
        client = MatrixClientPeg.safeGet();
        client.supportsThreads = jest.fn().mockReturnValue(true);
        room = new Room("!room:server", client, client.getSafeUserId());
        mocked(client.getRoom).mockReturnValue(room);

        jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it("should show a spinner before the promise resolves", async () => {
        const deferred = defer<ISearchResults>();

        render(
            <RoomSearchView
                inProgress={true}
                term="search term"
                scope={SearchScope.All}
                promise={deferred.promise}
                resizeNotifier={resizeNotifier}
                className="someClass"
                onUpdate={jest.fn()}
            />,
        );

        await screen.findByTestId("messagePanelSearchSpinner");
    });

    it("should render results when the promise resolves", async () => {
        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve<ISearchResults>({
                        results: [
                            SearchResult.fromJson(
                                {
                                    rank: 1,
                                    result: {
                                        room_id: room.roomId,
                                        event_id: "$2",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 1,
                                        content: { body: "Foo Test Bar", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [
                                            {
                                                room_id: room.roomId,
                                                event_id: "$1",
                                                sender: client.getSafeUserId(),
                                                origin_server_ts: 1,
                                                content: { body: "Before", msgtype: "m.text" },
                                                type: EventType.RoomMessage,
                                            },
                                        ],
                                        events_after: [
                                            {
                                                room_id: room.roomId,
                                                event_id: "$3",
                                                sender: client.getSafeUserId(),
                                                origin_server_ts: 1,
                                                content: { body: "After", msgtype: "m.text" },
                                                type: EventType.RoomMessage,
                                            },
                                        ],
                                    },
                                },
                                eventMapper,
                            ),
                        ],
                        highlights: [],
                        count: 1,
                    })}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        await screen.findByText("Before");
        await screen.findByText("Foo Test Bar");
        await screen.findByText("After");
    });

    it("should highlight words correctly", async () => {
        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.Room}
                    promise={Promise.resolve<ISearchResults>({
                        results: [
                            SearchResult.fromJson(
                                {
                                    rank: 1,
                                    result: {
                                        room_id: room.roomId,
                                        event_id: "$2",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 1,
                                        content: { body: "Foo Test Bar", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [],
                                        events_after: [],
                                    },
                                },
                                eventMapper,
                            ),
                        ],
                        highlights: ["test"],
                        count: 1,
                    })}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        const text = await screen.findByText("Test");
        expect(text).toHaveClass("mx_EventTile_searchHighlight");
    });

    it("should show spinner above results when backpaginating", async () => {
        const searchResults: ISearchResults = {
            results: [
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: "$2",
                            sender: client.getSafeUserId(),
                            origin_server_ts: 1,
                            content: { body: "Foo Test Bar", msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: {
                            profile_info: {},
                            events_before: [],
                            events_after: [],
                        },
                    },
                    eventMapper,
                ),
            ],
            highlights: ["test"],
            next_batch: "next_batch",
            count: 2,
        };

        mocked(searchPagination).mockResolvedValue({
            ...searchResults,
            results: [
                ...searchResults.results,
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: "$4",
                            sender: client.getSafeUserId(),
                            origin_server_ts: 4,
                            content: { body: "Potato", msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: {
                            profile_info: {},
                            events_before: [],
                            events_after: [],
                        },
                    },
                    eventMapper,
                ),
            ],
            next_batch: undefined,
        });
        const onUpdate = jest.fn();

        const { rerender } = render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={true}
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve(searchResults)}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={onUpdate}
                />
            </MatrixClientContext.Provider>,
        );

        await screen.findByRole("progressbar");
        await screen.findByText("Potato");
        expect(onUpdate).toHaveBeenCalledWith(false, expect.objectContaining({}));

        rerender(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve(searchResults)}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        expect(screen.queryByRole("progressbar")).toBeFalsy();
    });

    it("should handle resolutions after unmounting sanely", async () => {
        const deferred = defer<ISearchResults>();

        const { unmount } = render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        unmount();
        deferred.resolve({
            results: [],
            highlights: [],
        });
    });

    it("should handle rejections after unmounting sanely", async () => {
        const deferred = defer<ISearchResults>();

        const { unmount } = render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        unmount();
        deferred.reject({
            results: [],
            highlights: [],
        });
    });

    it("should show modal if error is encountered", async () => {
        const deferred = defer<ISearchResults>();

        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );
        deferred.reject(new Error("Some error"));

        await screen.findByText("Search failed");
        await screen.findByText("Some error");
    });

    it("should combine search results when the query is present in multiple sucessive messages", async () => {
        const searchResults: ISearchResults = {
            results: [
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: "$4",
                            sender: client.getUserId() ?? "",
                            origin_server_ts: 1,
                            content: { body: "Foo2", msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: {
                            profile_info: {},
                            events_before: [
                                {
                                    room_id: room.roomId,
                                    event_id: "$3",
                                    sender: client.getUserId() ?? "",
                                    origin_server_ts: 1,
                                    content: { body: "Between", msgtype: "m.text" },
                                    type: EventType.RoomMessage,
                                },
                            ],
                            events_after: [
                                {
                                    room_id: room.roomId,
                                    event_id: "$5",
                                    sender: client.getUserId() ?? "",
                                    origin_server_ts: 1,
                                    content: { body: "After", msgtype: "m.text" },
                                    type: EventType.RoomMessage,
                                },
                            ],
                        },
                    },
                    eventMapper,
                ),
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: "$2",
                            sender: client.getUserId() ?? "",
                            origin_server_ts: 1,
                            content: { body: "Foo", msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: {
                            profile_info: {},
                            events_before: [
                                {
                                    room_id: room.roomId,
                                    event_id: "$1",
                                    sender: client.getUserId() ?? "",
                                    origin_server_ts: 1,
                                    content: { body: "Before", msgtype: "m.text" },
                                    type: EventType.RoomMessage,
                                },
                            ],
                            events_after: [
                                {
                                    room_id: room.roomId,
                                    event_id: "$3",
                                    sender: client.getUserId() ?? "",
                                    origin_server_ts: 1,
                                    content: { body: "Between", msgtype: "m.text" },
                                    type: EventType.RoomMessage,
                                },
                            ],
                        },
                    },
                    eventMapper,
                ),
            ],
            highlights: [],
            next_batch: "",
            count: 1,
        };

        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve(searchResults)}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        const beforeNode = await screen.findByText("Before");
        const fooNode = await screen.findByText("Foo");
        const betweenNode = await screen.findByText("Between");
        const foo2Node = await screen.findByText("Foo2");
        const afterNode = await screen.findByText("After");

        expect((await screen.findAllByText("Between")).length).toBe(1);

        expect(beforeNode.compareDocumentPosition(fooNode) == Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(fooNode.compareDocumentPosition(betweenNode) == Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(betweenNode.compareDocumentPosition(foo2Node) == Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(foo2Node.compareDocumentPosition(afterNode) == Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should pass appropriate permalink creator for all rooms search", async () => {
        const room2 = new Room("!room2:server", client, client.getSafeUserId());
        const room3 = new Room("!room3:server", client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation(
            (roomId) => [room, room2, room3].find((r) => r.roomId === roomId) ?? null,
        );

        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    inProgress={false}
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve<ISearchResults>({
                        results: [
                            SearchResult.fromJson(
                                {
                                    rank: 1,
                                    result: {
                                        room_id: room.roomId,
                                        event_id: "$2",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 1,
                                        content: { body: "Room 1", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [],
                                        events_after: [],
                                    },
                                },
                                eventMapper,
                            ),
                            SearchResult.fromJson(
                                {
                                    rank: 2,
                                    result: {
                                        room_id: room2.roomId,
                                        event_id: "$22",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 1,
                                        content: { body: "Room 2", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [],
                                        events_after: [],
                                    },
                                },
                                eventMapper,
                            ),
                            SearchResult.fromJson(
                                {
                                    rank: 2,
                                    result: {
                                        room_id: room2.roomId,
                                        event_id: "$23",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 2,
                                        content: { body: "Room 2 message 2", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [],
                                        events_after: [],
                                    },
                                },
                                eventMapper,
                            ),
                            SearchResult.fromJson(
                                {
                                    rank: 3,
                                    result: {
                                        room_id: room3.roomId,
                                        event_id: "$32",
                                        sender: client.getSafeUserId(),
                                        origin_server_ts: 1,
                                        content: { body: "Room 3", msgtype: "m.text" },
                                        type: EventType.RoomMessage,
                                    },
                                    context: {
                                        profile_info: {},
                                        events_before: [],
                                        events_after: [],
                                    },
                                },
                                eventMapper,
                            ),
                        ],
                        highlights: [],
                        count: 1,
                    })}
                    resizeNotifier={resizeNotifier}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        const event1 = await screen.findByText("Room 1");
        expect(event1.closest(".mx_EventTile_line")!.querySelector("a")).toHaveAttribute(
            "href",
            `https://matrix.to/#/${room.roomId}/$2`,
        );

        const event2 = await screen.findByText("Room 2");
        expect(event2.closest(".mx_EventTile_line")!.querySelector("a")).toHaveAttribute(
            "href",
            `https://matrix.to/#/${room2.roomId}/$22`,
        );

        const event2Message2 = await screen.findByText("Room 2 message 2");
        expect(event2Message2.closest(".mx_EventTile_line")!.querySelector("a")).toHaveAttribute(
            "href",
            `https://matrix.to/#/${room2.roomId}/$23`,
        );

        const event3 = await screen.findByText("Room 3");
        expect(event3.closest(".mx_EventTile_line")!.querySelector("a")).toHaveAttribute(
            "href",
            `https://matrix.to/#/${room3.roomId}/$32`,
        );
    });
});
