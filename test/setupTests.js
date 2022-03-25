import { TextEncoder, TextDecoder } from 'util';
import Adapter from "@wojtekmaj/enzyme-adapter-react-17";
import { configure } from "enzyme";
import "blob-polyfill"; // https://github.com/jsdom/jsdom/issues/2555

import * as languageHandler from "../src/languageHandler";
import SdkConfig, { DEFAULTS } from '../src/SdkConfig';

languageHandler.setLanguage('en');
languageHandler.setMissingEntryGenerator(key => key.split("|", 2)[1]);

// uninitialised SdkConfig causes lots of warnings in console
// init with defaults
SdkConfig.put(DEFAULTS);

require('jest-fetch-mock').enableMocks();

// jest 27 removes setImmediate from jsdom
// polyfill until setImmediate use in client can be removed
global.setImmediate = callback => setTimeout(callback, 0);

// Stub ResizeObserver
class ResizeObserver {
    observe() {} // do nothing
    unobserve() {} // do nothing
    disconnect() {} // do nothing
}
window.ResizeObserver = ResizeObserver;

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

configure({ adapter: new Adapter() });

// maplibre requires a createObjectURL mock
global.URL.createObjectURL = jest.fn();

// matchMedia is not included in jsdom
const mockMatchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
}));
global.matchMedia = mockMatchMedia;

window.HTMLElement.prototype.scrollIntoView = jest.fn();
