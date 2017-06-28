#!/usr/bin/env node
const EMOJI_DATA = require('emojione/emoji.json');
const fs = require('fs');

const output = Object.keys(EMOJI_DATA).map(
    (key) => {
        const datum = EMOJI_DATA[key];
        return {
            name: datum.name,
            shortname: datum.shortname,
            category: datum.category,
            emoji_order: datum.emoji_order,
        };
    }
);

fs.writeFileSync('./lib/stripped-emoji.json', JSON.stringify(output));
