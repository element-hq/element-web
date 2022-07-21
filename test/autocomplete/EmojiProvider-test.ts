/*
Copyright 2022 Ryan Browne <code@commonlawfeature.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import EmojiProvider from '../../src/autocomplete/EmojiProvider';
import { mkStubRoom } from '../test-utils/test-utils';
import { add } from "../../src/emojipicker/recent";
import { stubClient } from "../test-utils";
import { MatrixClientPeg } from '../../src/MatrixClientPeg';

const EMOJI_SHORTCODES = [
    ":+1",
    ":heart",
    ":grinning",
    ":hand",
    ":man",
    ":sweat",
    ":monkey",
    ":boat",
    ":mailbox",
    ":cop",
    ":bow",
    ":kiss",
    ":golf",
];

// Some emoji shortcodes are too short and do not actually trigger autocompletion until the ending `:`.
// This means that we cannot compare their autocompletion before and after the ending `:` and have
// to simply assert that the final completion with the colon is the exact emoji.
const TOO_SHORT_EMOJI_SHORTCODE = [
    { emojiShortcode: ":o", expectedEmoji: "⭕️" },
];

describe('EmojiProvider', function() {
    const testRoom = mkStubRoom(undefined, undefined, undefined);
    stubClient();
    MatrixClientPeg.get();

    it.each(EMOJI_SHORTCODES)('Returns consistent results after final colon %s', async function(emojiShortcode) {
        const ep = new EmojiProvider(testRoom);
        const range = { "beginning": true, "start": 0, "end": 3 };
        const completionsBeforeColon = await ep.getCompletions(emojiShortcode, range);
        const completionsAfterColon = await ep.getCompletions(emojiShortcode + ':', range);

        const firstCompletionWithoutColon = completionsBeforeColon[0].completion;
        const firstCompletionWithColon = completionsAfterColon[0].completion;

        expect(firstCompletionWithoutColon).toEqual(firstCompletionWithColon);
    });

    it.each(
        TOO_SHORT_EMOJI_SHORTCODE,
    )('Returns correct results after final colon $emojiShortcode', async ({ emojiShortcode, expectedEmoji }) => {
        const ep = new EmojiProvider(testRoom);
        const range = { "beginning": true, "start": 0, "end": 3 };
        const completions = await ep.getCompletions(emojiShortcode + ':', range);

        expect(completions[0].completion).toEqual(expectedEmoji);
    });

    it('Returns correct autocompletion based on recently used emoji', async function() {
        add("😘"); //kissing_heart
        add("😘");
        add("😚"); //kissing_closed_eyes
        const emojiProvider = new EmojiProvider(null);

        let completionsList = await emojiProvider.getCompletions(":kis", { beginning: true, end: 3, start: 3 });
        expect(completionsList[0].component.props.title).toEqual(":kissing_heart:");
        expect(completionsList[1].component.props.title).toEqual(":kissing_closed_eyes:");

        completionsList = await emojiProvider.getCompletions(":kissing_c", { beginning: true, end: 3, start: 3 });
        expect(completionsList[0].component.props.title).toEqual(":kissing_closed_eyes:");

        completionsList = await emojiProvider.getCompletions(":so", { beginning: true, end: 2, start: 2 });
        expect(completionsList[0].component.props.title).toEqual(":sob:");
    });
});
