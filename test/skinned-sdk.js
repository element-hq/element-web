/*
 * skinned-sdk.js
 *
 * Skins the react-sdk with a few stub components which we expect the
 * application to provide
 */

/* this is a convenient place to ensure we load the compatibility libraries we expect our
 * app to provide
 */

// for ES6 stuff like startsWith() and Object.values() that babel doesn't do by
// default
require('babel-polyfill');

var sdk = require("../src/index");

var skin = require('../src/component-index.js');
var stubComponent = require('./components/stub-component.js');

var components = skin.components;
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
components['views.rooms.SearchBar'] = stubComponent();

sdk.loadSkin(skin);

module.exports = sdk;
