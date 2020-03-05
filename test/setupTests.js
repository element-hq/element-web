import * as languageHandler from "../src/languageHandler";

languageHandler.setLanguage('en');
languageHandler.setMissingEntryGenerator(key => key.split("|", 2)[1]);
