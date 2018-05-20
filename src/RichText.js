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

import React from 'react';

import * as sdk from './index';
import * as emojione from 'emojione';

import { SelectionRange } from "./autocomplete/Autocompleter";


export function unicodeToEmojiUri(str) {
    let replaceWith, unicode, alt;
    if ((!emojione.unicodeAlt) || (emojione.sprites)) {
        // if we are using the shortname as the alt tag then we need a reversed array to map unicode code point to shortnames
        const mappedUnicode = emojione.mapUnicodeToShort();
    }

    str = str.replace(emojione.regUnicode, function(unicodeChar) {
        if ( (typeof unicodeChar === 'undefined') || (unicodeChar === '') || (!(unicodeChar in emojione.jsEscapeMap)) ) {
            // if the unicodeChar doesnt exist just return the entire match
            return unicodeChar;
        } else {
            // Remove variant selector VS16 (explicitly emoji) as it is unnecessary and leads to an incorrect URL below
            if (unicodeChar.length == 2 && unicodeChar[1] == '\ufe0f') {
                unicodeChar = unicodeChar[0];
            }

            // get the unicode codepoint from the actual char
            unicode = emojione.jsEscapeMap[unicodeChar];

            return emojione.imagePathSVG+unicode+'.svg'+emojione.cacheBustParam;
        }
    });

    return str;
}
