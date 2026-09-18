/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, getByTestId, render } from "test-utils-rtl";
import * as maplibregl from "maplibre-gl";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { getMockClientWithEventEmitter, getMockGeolocationPositionError } from "test-utils";

import Map from "./Map";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { TILE_SERVER_WK_KEY } from "../../../utils/WellKnownUtils";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

vi.mock("maplibre-gl");

describe("<Map />", () => {
    const defaultProps = {
        centerGeoUri: "geo:52,41",
        id: "test-123",
        onError: vi.fn(),
        onClick: vi.fn(),
    };
    const matrixClient = getMockClientWithEventEmitter({
        getClientWellKnown: vi.fn().mockReturnValue({
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
        vi.clearAllMocks();
        matrixClient.getClientWellKnown.mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        });

        vi.spyOn(logger, "error").mockRestore();
        vi.mocked(maplibregl.GeolocateControl).mockClear();
    });

    afterEach(() => {
        vi.spyOn(logger, "error").mockRestore();
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
            const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
            getComponent({ centerGeoUri: "123 Sesame Street" });
            expect(mockMap.setCenter).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith("Could not set map center", expect.any(Error));
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
            const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
            const bounds = { north: "a", south: "b", east: 42, west: 41 };
            getComponent({ bounds });
            expect(mockMap.fitBounds).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith("Invalid map bounds", expect.any(Error));
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
            const onClick = vi.fn();
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
            const onClick = vi.fn();
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
            vi.spyOn(mockGeolocate, "on");
            const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
            vi.spyOn(Modal, "createDialog");

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
            vi.spyOn(mockGeolocate, "on");
            vi.spyOn(mockGeolocate, "off");
            vi.spyOn(Modal, "createDialog");

            const { unmount } = getComponent({ allowGeolocate: true });

            expect(mockGeolocate.on).toHaveBeenCalled();

            unmount();

            expect(mockGeolocate.off).toHaveBeenCalled();
        });
    });
});
