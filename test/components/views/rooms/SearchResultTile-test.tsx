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

import * as React from "react";
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { SearchResult } from "matrix-js-sdk/src/models/search-result";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { createTestClient } from "../../../test-utils";
import EventTile from "../../../../src/components/views/rooms/EventTile";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SearchResultTile from "../../../../src/components/views/rooms/SearchResultTile";

describe("SearchResultTile", () => {
    beforeAll(() => {
        MatrixClientPeg.get = () => createTestClient();
    });

    it("Sets up appropriate callEventGrouper for m.call. events", () => {
        const wrapper = mount(
            <SearchResultTile
                searchResult={SearchResult.fromJson({
                    rank: 0.00424866,
                    result: {
                        content: {
                            body: "This is an example text message",
                            format: "org.matrix.custom.html",
                            formatted_body: "<b>This is an example text message</b>",
                            msgtype: "m.text",
                        },
                        event_id: "$144429830826TWwbB:localhost",
                        origin_server_ts: 1432735824653,
                        room_id: "!qPewotXpIctQySfjSy:localhost",
                        sender: "@example:example.org",
                        type: "m.room.message",
                        unsigned: {
                            age: 1234,
                        },
                    },
                    context: {
                        end: "",
                        start: "",
                        profile_info: {},
                        events_before: [{
                            type: EventType.CallInvite,
                            sender: "@user1:server",
                            room_id: "!qPewotXpIctQySfjSy:localhost",
                            origin_server_ts: 1432735824652,
                            content: { call_id: "call.1" },
                            event_id: "$1:server",
                        }],
                        events_after: [{
                            type: EventType.CallAnswer,
                            sender: "@user2:server",
                            room_id: "!qPewotXpIctQySfjSy:localhost",
                            origin_server_ts: 1432735824654,
                            content: { call_id: "call.1" },
                            event_id: "$2:server",
                        }],
                    },
                }, o => new MatrixEvent(o))}
            />,
        );

        const tiles = wrapper.find(EventTile);
        expect(tiles.length).toEqual(2);
        expect(tiles.at(0).prop("mxEvent").getId()).toBe("$1:server");
        // @ts-ignore accessing private property
        expect(tiles.at(0).prop("callEventGrouper").events.size).toBe(2);
        expect(tiles.at(1).prop("mxEvent").getId()).toBe("$144429830826TWwbB:localhost");
    });
});
