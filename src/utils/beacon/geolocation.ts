/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

// map GeolocationPositionError codes
// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
export enum GeolocationError {
    // no navigator.geolocation
    Unavailable = "Unavailable",
    // The acquisition of the geolocation information failed because the page didn't have the permission to do it.
    PermissionDenied = "PermissionDenied",
    // The acquisition of the geolocation failed because at least one internal source of position returned an internal error.
    PositionUnavailable = "PositionUnavailable",
    // The time allowed to acquire the geolocation was reached before the information was obtained.
    Timeout = "Timeout",
    // other unexpected failure
    Default = "Default",
}

const GeolocationOptions = {
    timeout: 10000,
    maximumAge: 60000,
};

const isGeolocationPositionError = (error: unknown): error is GeolocationPositionError =>
    typeof error === "object" && !!(error as GeolocationPositionError)["PERMISSION_DENIED"];
/**
 * Maps GeolocationPositionError to our GeolocationError enum
 */
export const mapGeolocationError = (error: GeolocationPositionError | Error | unknown): GeolocationError => {
    logger.error("Geolocation failed", error);

    if (isGeolocationPositionError(error)) {
        switch (error?.code) {
            case error.PERMISSION_DENIED:
                return GeolocationError.PermissionDenied;
            case error.POSITION_UNAVAILABLE:
                return GeolocationError.PositionUnavailable;
            case error.TIMEOUT:
                return GeolocationError.Timeout;
            default:
                return GeolocationError.Default;
        }
    } else if (error instanceof Error && error.message === GeolocationError.Unavailable) {
        return GeolocationError.Unavailable;
    } else {
        return GeolocationError.Default;
    }
};

const getGeolocation = (): Geolocation => {
    if (!navigator.geolocation) {
        throw new Error(GeolocationError.Unavailable);
    }
    return navigator.geolocation;
};

export type GenericPosition = {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    timestamp: number;
};

export type TimedGeoUri = {
    geoUri: string;
    timestamp: number;
};

export const genericPositionFromGeolocation = (geoPosition: GeolocationPosition): GenericPosition => {
    const { latitude, longitude, altitude, accuracy } = geoPosition.coords;

    return {
        // safari reports geolocation timestamps as Apple Cocoa Core Data timestamp
        // or ms since 1/1/2001 instead of the regular epoch
        // they also use local time, not utc
        // to simplify, just use Date.now()
        timestamp: Date.now(),
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        accuracy,
    };
};

export const getGeoUri = (position: GenericPosition): string => {
    const lat = position.latitude;
    const lon = position.longitude;
    const alt = Number.isFinite(position.altitude) ? `,${position.altitude}` : "";
    const acc = Number.isFinite(position.accuracy) ? `;u=${position.accuracy}` : "";
    return `geo:${lat},${lon}${alt}${acc}`;
};

export const mapGeolocationPositionToTimedGeo = (position: GeolocationPosition): TimedGeoUri => {
    const genericPosition = genericPositionFromGeolocation(position);
    return { timestamp: genericPosition.timestamp, geoUri: getGeoUri(genericPosition) };
};

/**
 * Gets current position, returns a promise
 * @returns Promise<GeolocationPosition>
 */
export const getCurrentPosition = async (): Promise<GeolocationPosition> => {
    try {
        const position = await new Promise((resolve: PositionCallback, reject) => {
            getGeolocation().getCurrentPosition(resolve, reject, GeolocationOptions);
        });
        return position;
    } catch (error) {
        throw new Error(mapGeolocationError(error));
    }
};

export type ClearWatchCallback = () => void;
export const watchPosition = (
    onWatchPosition: PositionCallback,
    onWatchPositionError: (error: GeolocationError) => void,
): ClearWatchCallback => {
    try {
        const onError = (error: GeolocationPositionError): void => onWatchPositionError(mapGeolocationError(error));
        const watchId = getGeolocation().watchPosition(onWatchPosition, onError, GeolocationOptions);
        const clearWatch = (): void => {
            getGeolocation().clearWatch(watchId);
        };
        return clearWatch;
    } catch (error) {
        throw new Error(mapGeolocationError(error));
    }
};
