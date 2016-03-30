/*
 * test-component-index.js
 *
 * Stub out a bunch of the components which we expect the application to
 * provide
 */
var components = require('../src/component-index.js').components;
var stubComponent = require('./components/stub-component.js');

components['structures.LeftPanel'] = stubComponent();
components['structures.RightPanel'] = stubComponent();
components['structures.RoomDirectory'] = stubComponent();
components['views.globals.MatrixToolbar'] = stubComponent();
components['views.globals.GuestWarningBar'] = stubComponent();
components['views.globals.NewVersionBar'] = stubComponent();
components['views.elements.Spinner'] = stubComponent({displayName: 'Spinner'});
components['views.messages.DateSeparator'] = stubComponent({displayName: 'DateSeparator'});
components['views.messages.MessageTimestamp'] = stubComponent({displayName: 'MessageTimestamp'});
components['views.messages.SenderProfile'] = stubComponent({displayName: 'SenderProfile'});

module.exports.components = components;
