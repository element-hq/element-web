const EventEmitter = require("events");
const { LngLat, NavigationControl } = require('maplibre-gl');

class MockMap extends EventEmitter {
    addControl = jest.fn();
    removeControl = jest.fn();
}
const MockMapInstance = new MockMap();

class MockGeolocateControl extends EventEmitter {
    trigger = jest.fn();
}
const MockGeolocateInstance = new MockGeolocateControl();
const MockMarker = {}
MockMarker.setLngLat = jest.fn().mockReturnValue(MockMarker);
MockMarker.addTo = jest.fn().mockReturnValue(MockMarker);
module.exports = {
    Map: jest.fn().mockReturnValue(MockMapInstance),
    GeolocateControl: jest.fn().mockReturnValue(MockGeolocateInstance),
    Marker: jest.fn().mockReturnValue(MockMarker),
    LngLat,
    NavigationControl
};
