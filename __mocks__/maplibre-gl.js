const EventEmitter = require("events");
const { LngLat } = require('maplibre-gl');

class MockMap extends EventEmitter {
    addControl = jest.fn();
    removeControl = jest.fn();
}
class MockGeolocateControl extends EventEmitter {

}
class MockMarker extends EventEmitter {
    setLngLat = jest.fn().mockReturnValue(this);
    addTo = jest.fn();
}
module.exports = {
    Map: MockMap,
    GeolocateControl: MockGeolocateControl,
    Marker: MockMarker,
    LngLat,
};
