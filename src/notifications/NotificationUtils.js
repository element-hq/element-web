/*
Copyright 2016 OpenMarket Ltd

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

'use strict';

module.exports = {
    // Encodes a dictionary of {
    //   "notify": true/false,
    //   "sound": string or undefined,
    //   "highlight: true/false,
    // }
    // to a list of push actions.
    encodeActions: function(action) {
        var notify = action.notify;
        var sound = action.sound;
        var highlight = action.highlight;
        if (notify) {
            var actions = ["notify"];
            if (sound) {
                actions.push({"set_tweak": "sound", "value": sound});
            }
            if (highlight) {
                actions.push({"set_tweak": "highlight"});
            } else {
                actions.push({"set_tweak": "highlight", "value": false});
            }
            return actions;
        } else {
            return ["dont_notify"];
        }
    },

    // Decode a list of actions to a dictionary of {
    //   "notify": true/false,
    //   "sound": string or undefined,
    //   "highlight: true/false,
    // }
    // If the actions couldn't be decoded then returns null.
    decodeActions: function(actions) {
        var notify = false;
        var sound = null;
        var highlight = false;

        for (var i = 0; i < actions.length; ++i) {
            var action = actions[i];
            if (action === "notify") {
                notify = true;
            } else if (action === "dont_notify") {
                notify = false;
            } else if (typeof action === 'object') {
                if (action.set_tweak === "sound") {
                    sound = action.value
                } else if (action.set_tweak === "highlight") {
                    highlight = action.value;
                } else {
                    // We don't understand this kind of tweak, so give up.
                    return null;
                }
            } else {
                // We don't understand this kind of action, so give up.
                return null;
            }
        }

        if (highlight === undefined) {
            // If a highlight tweak is missing a value then it defaults to true.
            highlight = true;
        }

        var result = {notify: notify, highlight: highlight};
        if (sound !== null) {
            result.sound = sound;
        }
        return result;
    },
};
