/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import { LOCATION_EVENT_TYPE } from "matrix-js-sdk/src/@types/location";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import sdk from "../../../skinned-sdk";
import { createMapSiteLink, parseGeoUri } from "../../../../src/components/views/messages/MLocationBody";

sdk.getComponent("views.messages.MLocationBody");

describe("MLocationBody", () => {
    describe("parseGeoUri", () => {
        it("fails if the supplied URI is empty", () => {
            expect(parseGeoUri("")).toBeFalsy();
        });

        // We use some examples from the spec, but don't check semantics
        // like two textually-different URIs being equal, since we are
        // just a humble parser.

        // Note: we do not understand geo URIs with percent-encoded coords
        // or accuracy.  It is RECOMMENDED in the spec never to percent-encode
        // these, but it is permitted, and we will fail to parse in that case.

        it("rfc5870 6.1 Simple 3-dimensional", () => {
            expect(parseGeoUri("geo:48.2010,16.3695,183")).toEqual(
                {
                    latitude: 48.2010,
                    longitude: 16.3695,
                    altitude: 183,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.2 Explicit CRS and accuracy", () => {
            expect(parseGeoUri("geo:48.198634,16.371648;crs=wgs84;u=40")).toEqual(
                {
                    latitude: 48.198634,
                    longitude: 16.371648,
                    altitude: undefined,
                    accuracy: 40,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.4 Negative longitude and explicit CRS", () => {
            expect(parseGeoUri("geo:90,-22.43;crs=WGS84")).toEqual(
                {
                    latitude: 90,
                    longitude: -22.43,
                    altitude: undefined,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.4 Integer lat and lon", () => {
            expect(parseGeoUri("geo:90,46")).toEqual(
                {
                    latitude: 90,
                    longitude: 46,
                    altitude: undefined,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.4 Percent-encoded param value", () => {
            expect(parseGeoUri("geo:66,30;u=6.500;FOo=this%2dthat")).toEqual(
                {
                    latitude: 66,
                    longitude: 30,
                    altitude: undefined,
                    accuracy: 6.500,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.4 Unknown param", () => {
            expect(parseGeoUri("geo:66.0,30;u=6.5;foo=this-that>")).toEqual(
                {
                    latitude: 66.0,
                    longitude: 30,
                    altitude: undefined,
                    accuracy: 6.5,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("rfc5870 6.4 Multiple unknown params", () => {
            expect(parseGeoUri("geo:70,20;foo=1.00;bar=white")).toEqual(
                {
                    latitude: 70,
                    longitude: 20,
                    altitude: undefined,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("Negative latitude", () => {
            expect(parseGeoUri("geo:-7.5,20")).toEqual(
                {
                    latitude: -7.5,
                    longitude: 20,
                    altitude: undefined,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });

        it("Zero altitude is not unknown", () => {
            expect(parseGeoUri("geo:-7.5,-20,0")).toEqual(
                {
                    latitude: -7.5,
                    longitude: -20,
                    altitude: 0,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
            );
        });
    });

    describe("createMapSiteLink", () => {
        it("returns null if event does not contain geouri", () => {
            expect(createMapSiteLink(nonLocationEvent())).toBeNull();
        });

        it("returns OpenStreetMap link if event contains m.location", () => {
            expect(
                createMapSiteLink(modernLocationEvent("geo:51.5076,-0.1276")),
            ).toEqual(
                "https://www.openstreetmap.org/" +
                "?mlat=51.5076&mlon=-0.1276" +
                "#map=16/51.5076/-0.1276",
            );
        });

        it("returns OpenStreetMap link if event contains geo_uri", () => {
            expect(
                createMapSiteLink(oldLocationEvent("geo:51.5076,-0.1276")),
            ).toEqual(
                "https://www.openstreetmap.org/" +
                "?mlat=51.5076&mlon=-0.1276" +
                "#map=16/51.5076/-0.1276",
            );
        });
    });
});

function oldLocationEvent(geoUri: string): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": LOCATION_EVENT_TYPE.name,
            "content": {
                "body": "Something about where I am",
                "msgtype": "m.location",
                "geo_uri": geoUri,
            },
        },
    );
}

function modernLocationEvent(geoUri: string): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": LOCATION_EVENT_TYPE.name,
            "content": makeLocationContent(
                `Found at ${geoUri} at 2021-12-21T12:22+0000`,
                geoUri,
                252523,
                "Human-readable label",
            ),
        },
    );
}

function nonLocationEvent(): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": "some.event.type",
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
            },
        },
    );
}

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
