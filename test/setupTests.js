import { TextEncoder, TextDecoder } from 'util';
import Adapter from "@wojtekmaj/enzyme-adapter-react-17";
import { configure } from "enzyme";

import * as languageHandler from "../src/languageHandler";

languageHandler.setLanguage('en');
languageHandler.setMissingEntryGenerator(key => key.split("|", 2)[1]);

require('jest-fetch-mock').enableMocks();

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

configure({ adapter: new Adapter() });

// maplibre requires a createObjectURL mock
global.URL.createObjectURL = jest.fn();
