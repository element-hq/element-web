/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const EventEmitter = require("events");
const { LngLat, NavigationControl, LngLatBounds } = require("maplibre-gl");

class MockMap extends EventEmitter {
    addControl = jest.fn();
    removeControl = jest.fn();
    zoomIn = jest.fn();
    zoomOut = jest.fn();
    setCenter = jest.fn();
    setStyle = jest.fn();
    fitBounds = jest.fn();
    remove = jest.fn();
}
const MockMapInstance = new MockMap();

class MockAttributionControl {}
class MockGeolocateControl extends EventEmitter {
    trigger = jest.fn();
}
const MockGeolocateInstance = new MockGeolocateControl();
const MockMarker = {};
MockMarker.setLngLat = jest.fn().mockReturnValue(MockMarker);
MockMarker.addTo = jest.fn().mockReturnValue(MockMarker);
MockMarker.remove = jest.fn().mockReturnValue(MockMarker);
module.exports = {
    Map: jest.fn().mockReturnValue(MockMapInstance),
    GeolocateControl: jest.fn().mockReturnValue(MockGeolocateInstance),
    Marker: jest.fn().mockReturnValue(MockMarker),
    LngLat,
    LngLatBounds,
    NavigationControl,
    AttributionControl: MockAttributionControl,
};
