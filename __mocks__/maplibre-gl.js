const EventEmitter = require("events");
const { LngLat, NavigationControl, LngLatBounds } = require('maplibre-gl');

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

class MockGeolocateControl extends EventEmitter {
    trigger = jest.fn();
}
const MockGeolocateInstance = new MockGeolocateControl();
const MockMarker = {}
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
};
