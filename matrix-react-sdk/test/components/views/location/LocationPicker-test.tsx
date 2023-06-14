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

import React from "react";
import { act, fireEvent, render, RenderResult } from "@testing-library/react";
import * as maplibregl from "maplibre-gl";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { mocked } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";

import LocationPicker from "../../../../src/components/views/location/LocationPicker";
import { LocationShareType } from "../../../../src/components/views/location/shareLocation";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { getMockClientWithEventEmitter, mockPlatformPeg } from "../../../test-utils";
import { findMapStyleUrl, LocationShareError } from "../../../../src/utils/location";

jest.mock("../../../../src/utils/location/findMapStyleUrl", () => ({
    findMapStyleUrl: jest.fn().mockReturnValue("tileserver.com"),
}));

// dropdown uses this
mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });

describe("LocationPicker", () => {
    describe("<LocationPicker />", () => {
        const roomId = "!room:server.org";
        const userId = "@user:server.org";
        const sender = new RoomMember(roomId, userId);
        const defaultProps = {
            sender,
            shareType: LocationShareType.Own,
            onChoose: jest.fn(),
            onFinished: jest.fn(),
        };
        const mockClient = getMockClientWithEventEmitter({
            isGuest: jest.fn(),
            getClientWellKnown: jest.fn(),
        });
        const getComponent = (props = {}): RenderResult =>
            render(<LocationPicker {...defaultProps} {...props} />, {
                wrapper: ({ children }) => (
                    <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
                ),
            });

        const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
        const mockMap = new maplibregl.Map(mapOptions);
        const mockGeolocate = new maplibregl.GeolocateControl({});
        const mockMarker = new maplibregl.Marker();

        const mockGeolocationPosition = {
            coords: {
                latitude: 43.2,
                longitude: 12.4,
                altitude: 12.3,
                accuracy: 21,
            },
            timestamp: 123,
        };
        const mockClickEvent = {
            lngLat: {
                lat: 43.2,
                lng: 12.4,
            },
        };

        beforeEach(() => {
            jest.spyOn(logger, "error").mockRestore();
            jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient as unknown as MatrixClient);
            jest.clearAllMocks();
            mocked(mockMap).addControl.mockReset();
            mocked(findMapStyleUrl).mockReturnValue("tileserver.com");
        });

        it("displays error when map emits an error", () => {
            // suppress expected error log
            jest.spyOn(logger, "error").mockImplementation(() => {});
            const { getByTestId, getByText } = getComponent();

            act(() => {
                // @ts-ignore
                mocked(mockMap).emit("error", { error: "Something went wrong" });
            });

            expect(getByTestId("map-rendering-error")).toBeInTheDocument();
            expect(
                getByText(
                    "This homeserver is not configured correctly to display maps, " +
                        "or the configured map server may be unreachable.",
                ),
            ).toBeInTheDocument();
        });

        it("displays error when map display is not configured properly", () => {
            // suppress expected error log
            jest.spyOn(logger, "error").mockImplementation(() => {});
            mocked(findMapStyleUrl).mockImplementation(() => {
                throw new Error(LocationShareError.MapStyleUrlNotConfigured);
            });

            const { getByText } = getComponent();

            expect(getByText("This homeserver is not configured to display maps.")).toBeInTheDocument();
        });

        it("displays error when WebGl is not enabled", () => {
            // suppress expected error log
            jest.spyOn(logger, "error").mockImplementation(() => {});
            mocked(findMapStyleUrl).mockImplementation(() => {
                throw new Error("Failed to initialize WebGL");
            });

            const { getByText } = getComponent();

            expect(
                getByText("WebGL is required to display maps, please enable it in your browser settings."),
            ).toBeInTheDocument();
        });

        it("displays error when map setup throws", () => {
            // suppress expected error log
            jest.spyOn(logger, "error").mockImplementation(() => {});

            // throw an error
            mocked(mockMap).addControl.mockImplementation(() => {
                throw new Error("oups");
            });

            const { getByText } = getComponent();

            expect(
                getByText(
                    "This homeserver is not configured correctly to display maps, " +
                        "or the configured map server may be unreachable.",
                ),
            ).toBeInTheDocument();
        });

        it("initiates map with geolocation", () => {
            getComponent();

            expect(mockMap.addControl).toHaveBeenCalledWith(mockGeolocate);
            act(() => {
                // @ts-ignore
                mocked(mockMap).emit("load");
            });

            expect(mockGeolocate.trigger).toHaveBeenCalled();
        });

        const testUserLocationShareTypes = (shareType: LocationShareType.Own | LocationShareType.Live) => {
            describe("user location behaviours", () => {
                it("closes and displays error when geolocation errors", () => {
                    // suppress expected error log
                    jest.spyOn(logger, "error").mockImplementation(() => {});
                    const onFinished = jest.fn();
                    getComponent({ onFinished, shareType });

                    expect(mockMap.addControl).toHaveBeenCalledWith(mockGeolocate);
                    act(() => {
                        // @ts-ignore
                        mockMap.emit("load");
                        // @ts-ignore
                        mockGeolocate.emit("error", {});
                    });

                    // dialog is closed on error
                    expect(onFinished).toHaveBeenCalled();
                });

                it("sets position on geolocate event", () => {
                    const { container, getByTestId } = getComponent({ shareType });
                    act(() => {
                        // @ts-ignore
                        mocked(mockGeolocate).emit("geolocate", mockGeolocationPosition);
                    });

                    // marker added
                    expect(maplibregl.Marker).toHaveBeenCalled();
                    expect(mockMarker.setLngLat).toHaveBeenCalledWith(new maplibregl.LngLat(12.4, 43.2));
                    // submit button is enabled when position is truthy
                    expect(getByTestId("location-picker-submit-button")).not.toBeDisabled();
                    expect(container.querySelector(".mx_BaseAvatar")).toBeInTheDocument();
                });

                it("disables submit button until geolocation completes", () => {
                    const onChoose = jest.fn();
                    const { getByTestId } = getComponent({ shareType, onChoose });

                    // button is disabled
                    expect(getByTestId("location-picker-submit-button")).toBeDisabled();
                    fireEvent.click(getByTestId("location-picker-submit-button"));
                    // nothing happens on button click
                    expect(onChoose).not.toHaveBeenCalled();

                    act(() => {
                        // @ts-ignore
                        mocked(mockGeolocate).emit("geolocate", mockGeolocationPosition);
                    });

                    // submit button is enabled when position is truthy
                    expect(getByTestId("location-picker-submit-button")).not.toBeDisabled();
                });

                it("submits location", () => {
                    const onChoose = jest.fn();
                    const { getByTestId } = getComponent({ onChoose, shareType });
                    act(() => {
                        // @ts-ignore
                        mocked(mockGeolocate).emit("geolocate", mockGeolocationPosition);
                        // make sure button is enabled
                    });

                    fireEvent.click(getByTestId("location-picker-submit-button"));
                    // content of this call is tested in LocationShareMenu-test
                    expect(onChoose).toHaveBeenCalled();
                });
            });
        };

        describe("for Own location share type", () => {
            testUserLocationShareTypes(LocationShareType.Own);
        });

        describe("for Live location share type", () => {
            const shareType = LocationShareType.Live;
            testUserLocationShareTypes(shareType);

            it("renders live duration dropdown with default option", () => {
                const { getByText } = getComponent({ shareType });
                expect(getByText("Share for 15m")).toBeInTheDocument();
            });

            it("updates selected duration", () => {
                const { getByText, getByLabelText } = getComponent({ shareType });

                // open dropdown
                fireEvent.click(getByLabelText("Share for 15m"));

                fireEvent.click(getByText("Share for 1h"));

                // value updated
                expect(getByText("Share for 1h")).toMatchSnapshot();
            });
        });

        describe("for Pin drop location share type", () => {
            const shareType = LocationShareType.Pin;
            it("initiates map with geolocation", () => {
                getComponent({ shareType });

                expect(mockMap.addControl).toHaveBeenCalledWith(mockGeolocate);
                act(() => {
                    // @ts-ignore
                    mocked(mockMap).emit("load");
                });

                expect(mockGeolocate.trigger).toHaveBeenCalled();
            });

            it("removes geolocation control on geolocation error", () => {
                // suppress expected error log
                jest.spyOn(logger, "error").mockImplementation(() => {});
                const onFinished = jest.fn();
                getComponent({ onFinished, shareType });
                act(() => {
                    // @ts-ignore
                    mockMap.emit("load");
                    // @ts-ignore
                    mockGeolocate.emit("error", {});
                });

                expect(mockMap.removeControl).toHaveBeenCalledWith(mockGeolocate);
                // dialog is not closed
                expect(onFinished).not.toHaveBeenCalled();
            });

            it("does not set position on geolocate event", () => {
                mocked(maplibregl.Marker).mockClear();
                const { container } = getComponent({ shareType });
                act(() => {
                    // @ts-ignore
                    mocked(mockGeolocate).emit("geolocate", mockGeolocationPosition);
                });

                // marker not added
                expect(container.querySelector("mx_Marker")).not.toBeInTheDocument();
            });

            it("sets position on click event", () => {
                const { container } = getComponent({ shareType });
                act(() => {
                    // @ts-ignore
                    mocked(mockMap).emit("click", mockClickEvent);
                });

                // marker added
                expect(maplibregl.Marker).toHaveBeenCalled();
                expect(mockMarker.setLngLat).toHaveBeenCalledWith(new maplibregl.LngLat(12.4, 43.2));

                // marker is set, icon not avatar
                expect(container.querySelector(".mx_Marker_icon")).toBeInTheDocument();
            });

            it("submits location", () => {
                const onChoose = jest.fn();
                const { getByTestId } = getComponent({ onChoose, shareType });
                act(() => {
                    // @ts-ignore
                    mocked(mockMap).emit("click", mockClickEvent);
                });

                fireEvent.click(getByTestId("location-picker-submit-button"));

                // content of this call is tested in LocationShareMenu-test
                expect(onChoose).toHaveBeenCalled();
            });
        });
    });
});
