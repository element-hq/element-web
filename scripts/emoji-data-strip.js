#!/usr/bin/env node
const EMOJI_DATA = require('emojione/emoji.json');
const EMOJI_SUPPORTED = Object.keys(require('emojione').emojioneList);
const fs = require('fs');

const output = Object.keys(EMOJI_DATA).map(
    (key) => {
        const datum = EMOJI_DATA[key];
        const newDatum = {
            name: datum.name,
            shortname: datum.shortname,
            category: datum.category,
            emoji_order: datum.emoji_order,
        };
        if (datum.aliases.length > 0) {
            newDatum.aliases = datum.aliases;
        }
        if (datum.aliases_ascii.length > 0) {
            newDatum.aliases_ascii = datum.aliases_ascii;
        }
        return newDatum;
    }
).filter((datum) => {
    return EMOJI_SUPPORTED.includes(datum.shortname);
});

// Write to a file in src. Changes should be checked into git. This file is copied by
// babel using --copy-files
fs.writeFileSync('./src/stripped-emoji.json', JSON.stringify(output));
