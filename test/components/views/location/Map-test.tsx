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
import { act, fireEvent, getByTestId, render } from "@testing-library/react";
import * as maplibregl from "maplibre-gl";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { mocked } from "jest-mock";

import Map from "../../../../src/components/views/location/Map";
import { getMockClientWithEventEmitter, getMockGeolocationPositionError } from "../../../test-utils";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { TILE_SERVER_WK_KEY } from "../../../../src/utils/WellKnownUtils";
import Modal from "../../../../src/Modal";
import ErrorDialog from "../../../../src/components/views/dialogs/ErrorDialog";

describe("<Map />", () => {
    const defaultProps = {
        centerGeoUri: "geo:52,41",
        id: "test-123",
        onError: jest.fn(),
        onClick: jest.fn(),
    };
    const matrixClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
    });
    const getComponent = (props = {}, renderingFn?: any) =>
        (renderingFn ?? render)(
            <MatrixClientContext.Provider value={matrixClient}>
                <Map {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
        matrixClient.getClientWellKnown.mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        });

        jest.spyOn(logger, "error").mockRestore();
        mocked(maplibregl.GeolocateControl).mockClear();
    });

    afterEach(() => {
        jest.spyOn(logger, "error").mockRestore();
    });

    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);

    it("renders", () => {
        const { container } = getComponent();
        expect(container.firstChild).not.toBeNull();
    });

    describe("onClientWellKnown emits", () => {
        it("updates map style when style url is truthy", () => {
            getComponent();

            act(() => {
                matrixClient.emit(ClientEvent.ClientWellKnown, {
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: "new.maps.com" },
                });
            });

            expect(mockMap.setStyle).toHaveBeenCalledWith("new.maps.com");
        });

        it("does not update map style when style url is truthy", () => {
            getComponent();

            act(() => {
                matrixClient.emit(ClientEvent.ClientWellKnown, {
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: undefined },
                });
            });

            expect(mockMap.setStyle).not.toHaveBeenCalledWith();
        });
    });

    describe("map centering", () => {
        it("does not try to center when no center uri provided", () => {
            getComponent({ centerGeoUri: null });
            expect(mockMap.setCenter).not.toHaveBeenCalled();
        });

        it("sets map center to centerGeoUri", () => {
            getComponent({ centerGeoUri: "geo:51,42" });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 51, lon: 42 });
        });

        it("handles invalid centerGeoUri", () => {
            const logSpy = jest.spyOn(logger, "error").mockImplementation();
            getComponent({ centerGeoUri: "123 Sesame Street" });
            expect(mockMap.setCenter).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith("Could not set map center");
        });

        it("updates map center when centerGeoUri prop changes", () => {
            const { rerender } = getComponent({ centerGeoUri: "geo:51,42" });

            getComponent({ centerGeoUri: "geo:53,45" }, rerender);
            getComponent({ centerGeoUri: "geo:56,47" }, rerender);
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 51, lon: 42 });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 53, lon: 45 });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 56, lon: 47 });
        });
    });

    describe("map bounds", () => {
        it("does not try to fit map bounds when no bounds provided", () => {
            getComponent({ bounds: null });
            expect(mockMap.fitBounds).not.toHaveBeenCalled();
        });

        it("fits map to bounds", () => {
            const bounds = { north: 51, south: 50, east: 42, west: 41 };
            getComponent({ bounds });
            expect(mockMap.fitBounds).toHaveBeenCalledWith(
                new maplibregl.LngLatBounds([bounds.west, bounds.south], [bounds.east, bounds.north]),
                { padding: 100, maxZoom: 15 },
            );
        });

        it("handles invalid bounds", () => {
            const logSpy = jest.spyOn(logger, "error").mockImplementation();
            const bounds = { north: "a", south: "b", east: 42, west: 41 };
            getComponent({ bounds });
            expect(mockMap.fitBounds).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith("Invalid map bounds");
        });

        it("updates map bounds when bounds prop changes", () => {
            const { rerender } = getComponent({ centerGeoUri: "geo:51,42" });

            const bounds = { north: 51, south: 50, east: 42, west: 41 };
            const bounds2 = { north: 53, south: 51, east: 45, west: 44 };

            getComponent({ bounds }, rerender);
            getComponent({ bounds: bounds2 }, rerender);
            expect(mockMap.fitBounds).toHaveBeenCalledTimes(2);
        });
    });

    describe("children", () => {
        it("renders without children", () => {
            const component = getComponent({ children: null });
            // no error
            expect(component).toBeTruthy();
        });

        it("renders children with map renderProp", () => {
            const children = ({ map }: { map: maplibregl.Map }) => (
                <div data-testid="test-child" data-map={map}>
                    Hello, world
                </div>
            );

            const { container } = getComponent({ children });

            // passes the map instance to the react children
            expect(getByTestId(container, "test-child").dataset.map).toBeTruthy();
        });
    });

    describe("onClick", () => {
        it("eats clicks to maplibre attribution button", () => {
            const onClick = jest.fn();
            getComponent({ onClick });

            act(() => {
                // this is added to the dom by maplibregl
                // which is mocked
                // just fake the target
                const fakeEl = document.createElement("div");
                fakeEl.className = "maplibregl-ctrl-attrib-button";
                fireEvent.click(fakeEl);
            });

            expect(onClick).not.toHaveBeenCalled();
        });

        it("calls onClick", () => {
            const onClick = jest.fn();
            const { container } = getComponent({ onClick });

            act(() => {
                fireEvent.click(container.firstChild);
            });

            expect(onClick).toHaveBeenCalled();
        });
    });

    describe("geolocate", () => {
        it("does not add a geolocate control when allowGeolocate is falsy", () => {
            getComponent({ allowGeolocate: false });

            // didn't create a geolocation control
            expect(maplibregl.GeolocateControl).not.toHaveBeenCalled();
        });

        it("creates a geolocate control and adds it to the map when allowGeolocate is truthy", () => {
            getComponent({ allowGeolocate: true });

            // didn't create a geolocation control
            expect(maplibregl.GeolocateControl).toHaveBeenCalledWith({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: false,
            });

            // mocked maplibregl shares mock for each mocked instance
            // so we can assert the geolocate control was added using this static mock
            const mockGeolocate = new maplibregl.GeolocateControl({});
            expect(mockMap.addControl).toHaveBeenCalledWith(mockGeolocate);
        });

        it("logs and opens a dialog on a geolocation error", () => {
            const mockGeolocate = new maplibregl.GeolocateControl({});
            jest.spyOn(mockGeolocate, "on");
            const logSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
            jest.spyOn(Modal, "createDialog");

            const { rerender } = getComponent({ allowGeolocate: true });

            // wait for component to settle
            getComponent({ allowGeolocate: true }, rerender);
            expect(mockGeolocate.on).toHaveBeenCalledWith("error", expect.any(Function));
            const error = getMockGeolocationPositionError(1, "Test");

            // @ts-ignore pretend to have geolocate emit an error
            mockGeolocate.emit("error", error);

            expect(logSpy).toHaveBeenCalledWith("Could not fetch location", error);

            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                title: "Could not fetch location",
                description:
                    "Element was denied permission to fetch your location. Please allow location access in your browser settings.",
            });
        });

        it("unsubscribes from geolocate errors on destroy", () => {
            const mockGeolocate = new maplibregl.GeolocateControl({});
            jest.spyOn(mockGeolocate, "on");
            jest.spyOn(mockGeolocate, "off");
            jest.spyOn(Modal, "createDialog");

            const { unmount } = getComponent({ allowGeolocate: true });

            expect(mockGeolocate.on).toHaveBeenCalled();

            unmount();

            expect(mockGeolocate.off).toHaveBeenCalled();
        });
    });
});
