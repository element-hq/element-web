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

import React from 'react';
import { mount } from "enzyme";
import { mocked } from 'jest-mock';
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import {
    M_ASSET,
    LocationAssetType,
    ILocationContent,
    M_LOCATION,
    M_TIMESTAMP,
} from "matrix-js-sdk/src/@types/location";
import { TEXT_NODE_TYPE } from "matrix-js-sdk/src/@types/extensible_events";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import maplibregl from 'maplibre-gl';
import { logger } from 'matrix-js-sdk/src/logger';

import sdk from "../../../skinned-sdk";
import MLocationBody, {
    createMapSiteLink,
    isSelfLocation,
    parseGeoUri,
} from "../../../../src/components/views/messages/MLocationBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import { getTileServerWellKnown } from "../../../../src/utils/WellKnownUtils";
import SdkConfig from "../../../../src/SdkConfig";

jest.mock("../../../../src/utils/WellKnownUtils", () => ({
    getTileServerWellKnown: jest.fn(),
}));

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
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

    describe("isSelfLocation", () => {
        it("Returns true for a full m.asset event", () => {
            const content = makeLocationContent("", '0');
            expect(isSelfLocation(content)).toBe(true);
        });

        it("Returns true for a missing m.asset", () => {
            const content = {
                body: "",
                msgtype: "m.location",
                geo_uri: "",
                [M_LOCATION.name]: { uri: "" },
                [TEXT_NODE_TYPE.name]: "",
                [M_TIMESTAMP.name]: 0,
                // Note: no m.asset!
            };
            expect(isSelfLocation(content as ILocationContent)).toBe(true);
        });

        it("Returns true for a missing m.asset type", () => {
            const content = {
                body: "",
                msgtype: "m.location",
                geo_uri: "",
                [M_LOCATION.name]: { uri: "" },
                [TEXT_NODE_TYPE.name]: "",
                [M_TIMESTAMP.name]: 0,
                [M_ASSET.name]: {
                    // Note: no type!
                },
            };
            expect(isSelfLocation(content as ILocationContent)).toBe(true);
        });

        it("Returns false for an unknown asset type", () => {
            const content = makeLocationContent(
                undefined, /* text */
                "geo:foo",
                0,
                undefined, /* description */
                "org.example.unknown" as unknown as LocationAssetType);
            expect(isSelfLocation(content)).toBe(false);
        });
    });

    describe('<MLocationBody>', () => {
        describe('with error', () => {
            const mockClient = {
                on: jest.fn(),
                off: jest.fn(),
            };
            const defaultEvent = modernLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Pin);
            const defaultProps = {
                mxEvent: defaultEvent,
                highlights: [],
                highlightLink: '',
                onHeightChanged: jest.fn(),
                onMessageAllowed: jest.fn(),
                permalinkCreator: {} as RoomPermalinkCreator,
                mediaEventHelper: {} as MediaEventHelper,
            };
            const getComponent = (props = {}) => mount(<MLocationBody {...defaultProps} {...props} />, {
                wrappingComponent: MatrixClientContext.Provider,
                wrappingComponentProps: { value: mockClient },
            });
            let sdkConfigSpy;

            beforeEach(() => {
                // eat expected errors to keep console clean
                jest.spyOn(logger, 'error').mockImplementation(() => { });
                mocked(getTileServerWellKnown).mockReturnValue({});
                sdkConfigSpy = jest.spyOn(SdkConfig, 'get').mockReturnValue({});
            });

            afterAll(() => {
                sdkConfigSpy.mockRestore();
                jest.spyOn(logger, 'error').mockRestore();
            });

            it('displays correct fallback content without error style when map_style_url is not configured', () => {
                const component = getComponent();
                expect(component.find(".mx_EventTile_body")).toMatchSnapshot();
            });

            it('displays correct fallback content when map_style_url is misconfigured', () => {
                const mockMap = new maplibregl.Map();
                mocked(getTileServerWellKnown).mockReturnValue({ map_style_url: 'bad-tile-server.com' });
                const component = getComponent();

                // simulate error initialising map in maplibregl
                // @ts-ignore
                mockMap.emit('error', { status: 404 });
                component.setProps({});
                expect(component.find(".mx_EventTile_body")).toMatchSnapshot();
            });
        });
    });
});

function oldLocationEvent(geoUri: string): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": M_LOCATION.name,
            "content": {
                "body": "Something about where I am",
                "msgtype": "m.location",
                "geo_uri": geoUri,
            },
        },
    );
}

function modernLocationEvent(geoUri: string, assetType?: LocationAssetType): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": M_LOCATION.name,
            "content": makeLocationContent(
                `Found at ${geoUri} at 2021-12-21T12:22+0000`,
                geoUri,
                252523,
                "Human-readable label",
                assetType,
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
