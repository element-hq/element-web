/*
Copyright 2015 - 2017 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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

import * as emojione from 'emojione';


export function unicodeToEmojiUri(str) {
    const mappedUnicode = emojione.mapUnicodeToShort();

    // remove any zero width joiners/spaces used in conjugate emojis as the emojione URIs don't contain them
    return str.replace(emojione.regUnicode, function(unicodeChar) {
        if ((typeof unicodeChar === 'undefined') || (unicodeChar === '') || (!(unicodeChar in emojione.jsEscapeMap))) {
            // if the unicodeChar doesn't exist just return the entire match
            return unicodeChar;
        } else {
            // get the unicode codepoint from the actual char
            const unicode = emojione.jsEscapeMap[unicodeChar];

            const short = mappedUnicode[unicode];
            const fname = emojione.emojioneList[short].fname;

            return emojione.imagePathSVG+fname+'.svg'+emojione.cacheBustParam;
        }
    });
}
