/*
 * test-component-index.js
 *
 * Stub out a bunch of the components which we expect the application to
 * provide
 */
var components = require('../src/component-index.js').components;
var stub = require('./components/stub-component.js');

components['structures.LeftPanel'] = stub;
components['structures.RightPanel'] = stub;
components['structures.RoomDirectory'] = stub;
components['views.globals.MatrixToolbar'] = stub;
components['views.globals.GuestWarningBar'] = stub;
components['views.globals.NewVersionBar'] = stub;
components['views.elements.Spinner'] = stub;

module.exports.components = components;
