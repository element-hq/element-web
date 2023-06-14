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

import { LocationAssetType, M_ASSET, M_LOCATION, M_TIMESTAMP } from "../../src/@types/location";
import { M_TOPIC } from "../../src/@types/topic";
import {
    makeBeaconContent,
    makeBeaconInfoContent,
    makeTopicContent,
    parseBeaconContent,
    parseTopicContent,
} from "../../src/content-helpers";
import { REFERENCE_RELATION } from "../../src/@types/extensible_events";

describe("Beacon content helpers", () => {
    describe("makeBeaconInfoContent()", () => {
        const mockDateNow = 123456789;
        beforeEach(() => {
            jest.spyOn(global.Date, "now").mockReturnValue(mockDateNow);
        });
        afterAll(() => {
            jest.spyOn(global.Date, "now").mockRestore();
        });
        it("create fully defined event content", () => {
            expect(makeBeaconInfoContent(1234, true, "nice beacon_info", LocationAssetType.Pin)).toEqual({
                description: "nice beacon_info",
                timeout: 1234,
                live: true,
                [M_TIMESTAMP.name]: mockDateNow,
                [M_ASSET.name]: {
                    type: LocationAssetType.Pin,
                },
            });
        });

        it("defaults timestamp to current time", () => {
            expect(makeBeaconInfoContent(1234, true, "nice beacon_info", LocationAssetType.Pin)).toEqual(
                expect.objectContaining({
                    [M_TIMESTAMP.name]: mockDateNow,
                }),
            );
        });

        it("uses timestamp when provided", () => {
            expect(makeBeaconInfoContent(1234, true, "nice beacon_info", LocationAssetType.Pin, 99999)).toEqual(
                expect.objectContaining({
                    [M_TIMESTAMP.name]: 99999,
                }),
            );
        });

        it("defaults asset type to self when not set", () => {
            expect(
                makeBeaconInfoContent(
                    1234,
                    true,
                    "nice beacon_info",
                    // no assetType passed
                ),
            ).toEqual(
                expect.objectContaining({
                    [M_ASSET.name]: {
                        type: LocationAssetType.Self,
                    },
                }),
            );
        });
    });

    describe("makeBeaconContent()", () => {
        it("creates event content without description", () => {
            expect(
                makeBeaconContent(
                    "geo:foo",
                    123,
                    "$1234",
                    // no description
                ),
            ).toEqual({
                [M_LOCATION.name]: {
                    description: undefined,
                    uri: "geo:foo",
                },
                [M_TIMESTAMP.name]: 123,
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: "$1234",
                },
            });
        });

        it("creates event content with description", () => {
            expect(makeBeaconContent("geo:foo", 123, "$1234", "test description")).toEqual({
                [M_LOCATION.name]: {
                    description: "test description",
                    uri: "geo:foo",
                },
                [M_TIMESTAMP.name]: 123,
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: "$1234",
                },
            });
        });
    });

    describe("parseBeaconContent()", () => {
        it("should not explode when parsing an invalid beacon", () => {
            // deliberate cast to simulate wire content being invalid
            const result = parseBeaconContent({} as any);
            expect(result).toEqual({
                description: undefined,
                uri: undefined,
                timestamp: undefined,
            });
        });

        it("should parse unstable values", () => {
            const uri = "urigoeshere";
            const description = "descriptiongoeshere";
            const timestamp = 1234;
            const result = parseBeaconContent({
                "org.matrix.msc3488.location": {
                    uri,
                    description,
                },
                "org.matrix.msc3488.ts": timestamp,

                // relationship not used - just here to satisfy types
                "m.relates_to": {
                    rel_type: "m.reference",
                    event_id: "$unused",
                },
            });
            expect(result).toEqual({
                description,
                uri,
                timestamp,
            });
        });

        it("should parse stable values", () => {
            const uri = "urigoeshere";
            const description = "descriptiongoeshere";
            const timestamp = 1234;
            const result = parseBeaconContent({
                "m.location": {
                    uri,
                    description,
                },
                "m.ts": timestamp,

                // relationship not used - just here to satisfy types
                "m.relates_to": {
                    rel_type: "m.reference",
                    event_id: "$unused",
                },
            });
            expect(result).toEqual({
                description,
                uri,
                timestamp,
            });
        });
    });
});

describe("Topic content helpers", () => {
    describe("makeTopicContent()", () => {
        it("creates fully defined event content without html", () => {
            expect(makeTopicContent("pizza")).toEqual({
                topic: "pizza",
                [M_TOPIC.name]: [
                    {
                        body: "pizza",
                        mimetype: "text/plain",
                    },
                ],
            });
        });

        it("creates fully defined event content with html", () => {
            expect(makeTopicContent("pizza", "<b>pizza</b>")).toEqual({
                topic: "pizza",
                [M_TOPIC.name]: [
                    {
                        body: "pizza",
                        mimetype: "text/plain",
                    },
                    {
                        body: "<b>pizza</b>",
                        mimetype: "text/html",
                    },
                ],
            });
        });
    });

    describe("parseTopicContent()", () => {
        it("parses event content with plain text topic without mimetype", () => {
            expect(
                parseTopicContent({
                    topic: "pizza",
                    [M_TOPIC.name]: [
                        {
                            body: "pizza",
                        },
                    ],
                }),
            ).toEqual({
                text: "pizza",
            });
        });

        it("parses event content with plain text topic", () => {
            expect(
                parseTopicContent({
                    topic: "pizza",
                    [M_TOPIC.name]: [
                        {
                            body: "pizza",
                            mimetype: "text/plain",
                        },
                    ],
                }),
            ).toEqual({
                text: "pizza",
            });
        });

        it("parses event content with html topic", () => {
            expect(
                parseTopicContent({
                    topic: "pizza",
                    [M_TOPIC.name]: [
                        {
                            body: "<b>pizza</b>",
                            mimetype: "text/html",
                        },
                    ],
                }),
            ).toEqual({
                text: "pizza",
                html: "<b>pizza</b>",
            });
        });
    });
});
