/*
Copyright 2017 Vector Creations Ltd

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

var MatrixClientPeg = require("./MatrixClientPeg");
import { _t } from './languageHandler';

module.exports = {
    usersTypingApartFromMe: function(room) {
        return this.usersTyping(
            room, [MatrixClientPeg.get().credentials.userId]
        );
    },

    /**
     * Given a Room object and, optionally, a list of userID strings
     * to exclude, return a list of user objects who are typing.
     */
    usersTyping: function(room, exclude) {
        var whoIsTyping = [];

        if (exclude === undefined) {
            exclude = [];
        }

        var memberKeys = Object.keys(room.currentState.members);
        for (var i = 0; i < memberKeys.length; ++i) {
            var userId = memberKeys[i];

            if (room.currentState.members[userId].typing) {
                if (exclude.indexOf(userId) == -1) {
                    whoIsTyping.push(room.currentState.members[userId]);
                }
            }
        }

        return whoIsTyping;
    },

    whoIsTypingString: function(whoIsTyping, limit) {
        let othersCount = 0;
        if (whoIsTyping.length > limit) {
            othersCount = whoIsTyping.length - limit + 1;
        }
        if (whoIsTyping.length == 0) {
            return '';
        } else if (whoIsTyping.length == 1) {
            return _t('%(displayName)s is typing', {displayName: whoIsTyping[0].name});
        }
        const names = whoIsTyping.map(function(m) {
            return m.name;
        });
        if (othersCount==1) {
            return _t('%(names)s and one other are typing', {names: names.slice(0, limit - 1).join(', ')});
        } else if (othersCount>1) {
        	return _t('%(names)s and %(count)s others are typing', {names: names.slice(0, limit - 1).join(', '), count: othersCount});
        } else {
            const lastPerson = names.pop();
            return _t('%(names)s and %(lastPerson)s are typing', {names: names.join(', '), lastPerson: lastPerson});
        }
    }
};
