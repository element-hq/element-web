import * as languageHandler from "../src/languageHandler";
import { TextEncoder, TextDecoder } from 'util';

languageHandler.setLanguage('en');
languageHandler.setMissingEntryGenerator(key => key.split("|", 2)[1]);

require('jest-fetch-mock').enableMocks();

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
