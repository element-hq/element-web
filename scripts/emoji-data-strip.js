#!/usr/bin/env node

// This generates src/stripped-emoji.json as used by the EmojiProvider autocomplete
// provider.

const EMOJIBASE = require('emojibase-data/en/compact.json');

const fs = require('fs');

const output = EMOJIBASE.map(
    (datum) => {
        const newDatum = {
            name: datum.annotation,
            shortname: `:${datum.shortcodes[0]}:`,
            category: datum.group,
            emoji_order: datum.order,
        };
        if (datum.shortcodes.length > 1) {
            newDatum.aliases = datum.shortcodes.slice(1).map(s => `:${s}:`);
        }
        if (datum.emoticon) {
            newDatum.aliases_ascii = [ datum.emoticon ];
        }
        return newDatum;
    }
);

// Write to a file in src. Changes should be checked into git. This file is copied by
// babel using --copy-files
fs.writeFileSync('./src/stripped-emoji.json', JSON.stringify(output));
