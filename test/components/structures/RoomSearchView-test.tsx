/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "@testing-library/react";
import { Room } from "matrix-js-sdk/src/models/room";
import { ISearchResults } from "matrix-js-sdk/src/@types/search";
import { defer } from "matrix-js-sdk/src/utils";
import { SearchResult } from "matrix-js-sdk/src/models/search-result";
import { IEvent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { RoomSearchView } from "../../../src/components/structures/RoomSearchView";
import { SearchScope } from "../../../src/components/views/rooms/SearchBar";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import { stubClient } from "../../test-utils";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { searchPagination } from "../../../src/Searching";

jest.mock("../../../src/Searching", () => ({
    searchPagination: jest.fn(),
}));

describe("<RoomSearchView/>", () => {
    const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
    const resizeNotifier = new ResizeNotifier();
    let client: MatrixClient;
    let room: Room;
    let permalinkCreator: RoomPermalinkCreator;

    beforeEach(async () => {
        stubClient();
        client = MatrixClientPeg.get();
        client.supportsExperimentalThreads = jest.fn().mockReturnValue(true);
        room = new Room("!room:server", client, client.getUserId());
        mocked(client.getRoom).mockReturnValue(room);
        permalinkCreator = new RoomPermalinkCreator(room, room.roomId);

        jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it("should show a spinner before the promise resolves", async () => {
        const deferred = defer<ISearchResults>();

        render(
            <RoomSearchView
                term="search term"
                scope={SearchScope.All}
                promise={deferred.promise}
                resizeNotifier={resizeNotifier}
                permalinkCreator={permalinkCreator}
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
                                        sender: client.getUserId(),
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
                                                sender: client.getUserId(),
                                                origin_server_ts: 1,
                                                content: { body: "Before", msgtype: "m.text" },
                                                type: EventType.RoomMessage,
                                            },
                                        ],
                                        events_after: [
                                            {
                                                room_id: room.roomId,
                                                event_id: "$3",
                                                sender: client.getUserId(),
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
                    permalinkCreator={permalinkCreator}
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
                                        sender: client.getUserId(),
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
                    permalinkCreator={permalinkCreator}
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
                            sender: client.getUserId(),
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
                            sender: client.getUserId(),
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

        render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve(searchResults)}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={permalinkCreator}
                    className="someClass"
                    onUpdate={jest.fn()}
                />
            </MatrixClientContext.Provider>,
        );

        await screen.findByRole("progressbar");
        await screen.findByText("Potato");
        expect(screen.queryByRole("progressbar")).toBeFalsy();
    });

    it("should handle resolutions after unmounting sanely", async () => {
        const deferred = defer<ISearchResults>();

        const { unmount } = render(
            <MatrixClientContext.Provider value={client}>
                <RoomSearchView
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={permalinkCreator}
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
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={permalinkCreator}
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
                    term="search term"
                    scope={SearchScope.All}
                    promise={deferred.promise}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={permalinkCreator}
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
                    term="search term"
                    scope={SearchScope.All}
                    promise={Promise.resolve(searchResults)}
                    resizeNotifier={resizeNotifier}
                    permalinkCreator={permalinkCreator}
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
});
