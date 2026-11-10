/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { vi } from "vitest";
// oxlint-disable-next-line no-restricted-imports -- the mock reuses the real maplibre-gl classes
import { LngLat, LngLatBounds, NavigationControl } from "maplibre-gl";

class MockMap extends EventEmitter {
    addControl = vi.fn();
    removeControl = vi.fn();
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    setCenter = vi.fn();
    setStyle = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();

    // A plain method rather than vi.fn() so tests which reset all mocks still get a canvas back
    private canvas?: HTMLCanvasElement;
    public getCanvas(): HTMLCanvasElement {
        this.canvas ??= document.createElement("canvas");
        return this.canvas;
    }
}
const mockMapInstance = new MockMap();

class MockAttributionControl {}
class MockGeolocateControl extends EventEmitter {
    trigger = vi.fn();
}
const mockGeolocateInstance = new MockGeolocateControl();

const mockMarker: {
    setLngLat: ReturnType<typeof vi.fn>;
    addTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
} = {} as any;
mockMarker.setLngLat = vi.fn().mockReturnValue(mockMarker);
mockMarker.addTo = vi.fn().mockReturnValue(mockMarker);
mockMarker.remove = vi.fn().mockReturnValue(mockMarker);

export const Map = vi.fn().mockImplementation(function () {
    return mockMapInstance;
});
export const GeolocateControl = vi.fn().mockImplementation(function () {
    return mockGeolocateInstance;
});
export const Marker = vi.fn().mockImplementation(function () {
    return mockMarker;
});
export { LngLat, LngLatBounds, NavigationControl };
export const AttributionControl = MockAttributionControl;
export const setWorkerUrl = vi.fn();

export default {
    Map,
    GeolocateControl,
    Marker,
    LngLat,
    LngLatBounds,
    NavigationControl,
    AttributionControl,
};
