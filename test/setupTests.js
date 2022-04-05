import Adapter from "@wojtekmaj/enzyme-adapter-react-17";
import { configure } from "enzyme";
import "blob-polyfill"; // https://github.com/jsdom/jsdom/issues/2555

// Enable the jest & enzyme mocks
require('jest-fetch-mock').enableMocks();
configure({ adapter: new Adapter() });

// Very carefully enable the mocks for everything else in
// a specific order. We use this order to ensure we properly
// establish an application state that actually works.
//
// These are also require() calls to make sure they get called
// synchronously.
require("./setup/setupManualMocks"); // must be first
require("./setup/setupLanguage");
require("./setup/setupConfig");
