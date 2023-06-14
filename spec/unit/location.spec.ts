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

import { makeLocationContent, parseLocationEvent } from "../../src/content-helpers";
import {
    M_ASSET,
    LocationAssetType,
    M_LOCATION,
    M_TIMESTAMP,
    LocationEventWireContent,
} from "../../src/@types/location";
import { M_TEXT } from "../../src/@types/extensible_events";
import { MsgType } from "../../src/@types/event";

describe("Location", function () {
    const defaultContent = {
        body: "Location geo:-36.24484561954707,175.46884959563613;u=10 at 2022-03-09T11:01:52.443Z",
        msgtype: "m.location",
        geo_uri: "geo:-36.24484561954707,175.46884959563613;u=10",
        [M_LOCATION.name]: { uri: "geo:-36.24484561954707,175.46884959563613;u=10", description: null },
        [M_ASSET.name]: { type: "m.self" },
        [M_TEXT.name]: "Location geo:-36.24484561954707,175.46884959563613;u=10 at 2022-03-09T11:01:52.443Z",
        [M_TIMESTAMP.name]: 1646823712443,
    } as any;

    const backwardsCompatibleEventContent = { ...defaultContent };

    // eslint-disable-next-line camelcase
    const { body, msgtype, geo_uri, ...modernProperties } = defaultContent;
    const modernEventContent = { ...modernProperties };

    const legacyEventContent = {
        body,
        msgtype,
        // eslint-disable-next-line camelcase
        geo_uri,
    } as LocationEventWireContent;

    it("should create a valid location with defaults", function () {
        const loc = makeLocationContent(undefined, "geo:foo", 134235435);
        expect(loc.body).toEqual("User Location geo:foo at 1970-01-02T13:17:15.435Z");
        expect(loc.msgtype).toEqual(MsgType.Location);
        expect(loc.geo_uri).toEqual("geo:foo");
        expect(M_LOCATION.findIn(loc)).toEqual({
            uri: "geo:foo",
            description: undefined,
        });
        expect(M_ASSET.findIn(loc)).toEqual({ type: LocationAssetType.Self });
        expect(M_TEXT.findIn(loc)).toEqual("User Location geo:foo at 1970-01-02T13:17:15.435Z");
        expect(M_TIMESTAMP.findIn(loc)).toEqual(134235435);
    });

    it("should create a valid location with explicit properties", function () {
        const loc = makeLocationContent(undefined, "geo:bar", 134235436, "desc", LocationAssetType.Pin);

        expect(loc.body).toEqual('Location "desc" geo:bar at 1970-01-02T13:17:15.436Z');
        expect(loc.msgtype).toEqual(MsgType.Location);
        expect(loc.geo_uri).toEqual("geo:bar");
        expect(M_LOCATION.findIn(loc)).toEqual({
            uri: "geo:bar",
            description: "desc",
        });
        expect(M_ASSET.findIn(loc)).toEqual({ type: LocationAssetType.Pin });
        expect(M_TEXT.findIn(loc)).toEqual('Location "desc" geo:bar at 1970-01-02T13:17:15.436Z');
        expect(M_TIMESTAMP.findIn(loc)).toEqual(134235436);
    });

    it("parses backwards compatible event correctly", () => {
        const eventContent = parseLocationEvent(backwardsCompatibleEventContent);

        expect(eventContent).toEqual(backwardsCompatibleEventContent);
    });

    it("parses modern correctly", () => {
        const eventContent = parseLocationEvent(modernEventContent);

        expect(eventContent).toEqual(backwardsCompatibleEventContent);
    });

    it("parses legacy event correctly", () => {
        const eventContent = parseLocationEvent(legacyEventContent);

        const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            [M_TIMESTAMP.name]: timestamp,
            ...expectedResult
        } = defaultContent;
        expect(eventContent).toEqual({
            ...expectedResult,
            [M_LOCATION.name]: {
                ...expectedResult[M_LOCATION.name],
                description: undefined,
            },
        });

        // don't infer timestamp from legacy event
        expect(M_TIMESTAMP.findIn(eventContent)).toBeFalsy();
    });
});
