/*
 * skinned-sdk.js
 *
 * Skins the react-sdk with a few stub components which we expect the
 * application to provide
 */

/* this is a convenient place to ensure we load the compatibility libraries we expect our
 * app to provide
 */

import * as sdk from "../src/index";
import stubComponent from "./components/stub-component";

const components = {};
components['structures.LeftPanel'] = stubComponent();
components['structures.RightPanel'] = stubComponent();
components['structures.RoomDirectory'] = stubComponent();
components['views.globals.GuestWarningBar'] = stubComponent();
components['views.globals.NewVersionBar'] = stubComponent();
components['views.elements.Spinner'] = stubComponent({displayName: 'Spinner'});
components['views.messages.DateSeparator'] = stubComponent({displayName: 'DateSeparator'});
components['views.messages.MessageTimestamp'] = stubComponent({displayName: 'MessageTimestamp'});
components['views.messages.SenderProfile'] = stubComponent({displayName: 'SenderProfile'});
components['views.rooms.SearchBar'] = stubComponent();

sdk.loadSkin({components});

export default sdk;
