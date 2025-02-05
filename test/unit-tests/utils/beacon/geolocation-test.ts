/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type Mocked } from "jest-mock";

import {
    type GenericPosition,
    GeolocationError,
    getGeoUri,
    mapGeolocationError,
    mapGeolocationPositionToTimedGeo,
    watchPosition,
} from "../../../../src/utils/beacon";
import { getCurrentPosition } from "../../../../src/utils/beacon/geolocation";
import { makeGeolocationPosition, mockGeolocation, getMockGeolocationPositionError } from "../../../test-utils";

describe("geolocation utilities", () => {
    let geolocation: Mocked<Geolocation>;
    const defaultPosition = makeGeolocationPosition({});

    // 14.03.2022 16:15
    const now = 1647270879403;

    beforeEach(() => {
        geolocation = mockGeolocation();
        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    afterEach(() => {
        jest.spyOn(Date, "now").mockRestore();
        jest.spyOn(logger, "error").mockRestore();
    });

    describe("getGeoUri", () => {
        it("Renders a URI with only lat and lon", () => {
            const pos: GenericPosition = {
                latitude: 43.2,
                longitude: 12.4,
                altitude: undefined,
                accuracy: undefined,

                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4");
        });

        it("Nulls in location are not shown in URI", () => {
            const pos: GenericPosition = {
                latitude: 43.2,
                longitude: 12.4,

                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4");
        });

        it("Renders a URI with 3 coords", () => {
            const pos: GenericPosition = {
                latitude: 43.2,
                longitude: 12.4,
                altitude: 332.54,
                accuracy: undefined,
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4,332.54");
        });

        it("Renders a URI with accuracy", () => {
            const pos: GenericPosition = {
                latitude: 43.2,
                longitude: 12.4,
                altitude: undefined,
                accuracy: 21,
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4;u=21");
        });

        it("Renders a URI with accuracy and altitude", () => {
            const pos = {
                latitude: 43.2,
                longitude: 12.4,
                altitude: 12.3,
                accuracy: 21,
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4,12.3;u=21");
        });
    });

    describe("mapGeolocationError", () => {
        beforeEach(() => {
            // suppress expected errors from test log
            jest.spyOn(logger, "error").mockImplementation(() => {});
        });

        it("returns default for other error", () => {
            const error = new Error("oh no..");
            expect(mapGeolocationError(error)).toEqual(GeolocationError.Default);
        });

        it("returns unavailable for unavailable error", () => {
            const error = new Error(GeolocationError.Unavailable);
            expect(mapGeolocationError(error)).toEqual(GeolocationError.Unavailable);
        });

        it("maps geo error permissiondenied correctly", () => {
            const error = getMockGeolocationPositionError(1, "message");
            expect(mapGeolocationError(error)).toEqual(GeolocationError.PermissionDenied);
        });

        it("maps geo position unavailable error correctly", () => {
            const error = getMockGeolocationPositionError(2, "message");
            expect(mapGeolocationError(error)).toEqual(GeolocationError.PositionUnavailable);
        });

        it("maps geo timeout error correctly", () => {
            const error = getMockGeolocationPositionError(3, "message");
            expect(mapGeolocationError(error)).toEqual(GeolocationError.Timeout);
        });
    });

    describe("mapGeolocationPositionToTimedGeo()", () => {
        it("maps geolocation position correctly", () => {
            expect(mapGeolocationPositionToTimedGeo(defaultPosition)).toEqual({
                timestamp: now,
                geoUri: "geo:54.001927,-8.253491;u=1",
            });
        });
    });

    describe("watchPosition()", () => {
        it("throws with unavailable error when geolocation is not available", () => {
            // suppress expected errors from test log
            jest.spyOn(logger, "error").mockImplementation(() => {});

            // remove the mock we added
            // @ts-ignore illegal assignment to readonly property
            navigator.geolocation = undefined;

            const positionHandler = jest.fn();
            const errorHandler = jest.fn();

            expect(() => watchPosition(positionHandler, errorHandler)).toThrow(GeolocationError.Unavailable);
        });

        it("sets up position handler with correct options", () => {
            const positionHandler = jest.fn();
            const errorHandler = jest.fn();
            watchPosition(positionHandler, errorHandler);

            const [, , options] = geolocation.watchPosition.mock.calls[0];
            expect(options).toEqual({
                maximumAge: 60000,
                timeout: 10000,
            });
        });

        it("returns clearWatch function", () => {
            const watchId = 1;
            geolocation.watchPosition.mockReturnValue(watchId);
            const positionHandler = jest.fn();
            const errorHandler = jest.fn();
            const clearWatch = watchPosition(positionHandler, errorHandler);

            clearWatch();

            expect(geolocation.clearWatch).toHaveBeenCalledWith(watchId);
        });

        it("calls position handler with position", () => {
            const positionHandler = jest.fn();
            const errorHandler = jest.fn();
            watchPosition(positionHandler, errorHandler);

            expect(positionHandler).toHaveBeenCalledWith(defaultPosition);
        });

        it("maps geolocation position error and calls error handler", () => {
            // suppress expected errors from test log
            jest.spyOn(logger, "error").mockImplementation(() => {});
            geolocation.watchPosition.mockImplementation((_callback, error) => {
                error!(getMockGeolocationPositionError(1, "message"));
                return -1;
            });
            const positionHandler = jest.fn();
            const errorHandler = jest.fn();
            watchPosition(positionHandler, errorHandler);

            expect(errorHandler).toHaveBeenCalledWith(GeolocationError.PermissionDenied);
        });
    });

    describe("getCurrentPosition()", () => {
        it("throws with unavailable error when geolocation is not available", async () => {
            // suppress expected errors from test log
            jest.spyOn(logger, "error").mockImplementation(() => {});

            // remove the mock we added
            // @ts-ignore illegal assignment to readonly property
            navigator.geolocation = undefined;

            await expect(() => getCurrentPosition()).rejects.toThrow(GeolocationError.Unavailable);
        });

        it("throws with geolocation error when geolocation.getCurrentPosition fails", async () => {
            // suppress expected errors from test log
            jest.spyOn(logger, "error").mockImplementation(() => {});

            const timeoutError = getMockGeolocationPositionError(3, "message");
            geolocation.getCurrentPosition.mockImplementation((callback, error) => error!(timeoutError));

            await expect(() => getCurrentPosition()).rejects.toThrow(GeolocationError.Timeout);
        });

        it("resolves with current location", async () => {
            geolocation.getCurrentPosition.mockImplementation((callback, error) => callback(defaultPosition));

            const result = await getCurrentPosition();
            expect(result).toEqual(defaultPosition);
        });
    });
});
