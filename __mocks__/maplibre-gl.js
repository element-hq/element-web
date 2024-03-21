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
