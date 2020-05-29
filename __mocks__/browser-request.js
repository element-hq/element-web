const en = require("../src/i18n/strings/en_EN");

module.exports = jest.fn((opts, cb) => {
    const url = opts.url || opts.uri;
    if (url && url.endsWith("languages.json")) {
        cb(undefined, {status: 200}, JSON.stringify({
            "en": {
                "fileName": "en_EN.json",
                "label": "English",
            },
        }));
    } else if (url && url.endsWith("en_EN.json")) {
        cb(undefined, {status: 200}, JSON.stringify(en));
    } else {
        cb(true, {status: 404}, "");
    }
});
