const en = require("../src/i18n/strings/en_EN");
const de = require("../src/i18n/strings/de_DE");

module.exports = jest.fn((opts, cb) => {
    const url = opts.url || opts.uri;
    if (url && url.endsWith("languages.json")) {
        cb(undefined, {status: 200}, JSON.stringify({
            "en": {
                "fileName": "en_EN.json",
                "label": "English",
            },
            "de": {
                "fileName": "de_DE.json",
                "label": "German",
            },
        }));
    } else if (url && url.endsWith("en_EN.json")) {
        cb(undefined, {status: 200}, JSON.stringify(en));
    } else if (url && url.endsWith("de_DE.json")) {
        cb(undefined, {status: 200}, JSON.stringify(de));
    } else {
        cb(true, {status: 404}, "");
    }
});
