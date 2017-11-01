/*
 Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

function memberEventDiff(ev) {
    const diff = {
        isMemberEvent: ev.getType() === 'm.room.member',
    };

    // If is not a Member Event then the other checks do not apply, so bail early.
    if (!diff.isMemberEvent) return diff;

    const content = ev.getContent();
    const prevContent = ev.getPrevContent();

    diff.isJoin = content.membership === 'join' && prevContent.membership !== 'ban';
    diff.isPart = content.membership === 'leave' && ev.getStateKey() === ev.getSender();

    const isJoinToJoin = content.membership === prevContent.membership && content.membership === 'join';
    diff.isDisplaynameChange = isJoinToJoin && content.displayname !== prevContent.displayname;
    diff.isAvatarChange = isJoinToJoin && content.avatar_url !== prevContent.avatar_url;
    return diff;
}

export default function shouldHideEvent(ev, syncedSettings) {
    // Hide redacted events
    if (syncedSettings['hideRedactions'] && ev.isRedacted()) return true;

    const eventDiff = memberEventDiff(ev);

    if (eventDiff.isMemberEvent) {
        // XXX: horrific hack for Status until granular settings lands, where these
        // can then be added into room state
        if (['!YkNaCvrOXIQKPMhUHC:status.im', // #announcements:status.im
             '!TSECabqXwnmkYVTfdX:status.im', // #general:status.im
             '!FhCoxZbSjazJYFlCOY:status.im', // #dev-status:status.im
             '!hHZWxpKcmFSjXcFHZC:status.im', // #news-articles:status.im
             '!gIfSnanKtRcKDpUcmR:status.im', // #introductions:status.im
             '!eGsKellGrAmpROBwXT:status.im', // #book-club:status.im
             '!AqnfKJOcxeeuMOcqRL:status.im', // #music:status.im
            ].includes(ev.getRoomId())
            && (/* eventDiff.isJoin ||
                eventDiff.isPart ||
                eventDiff.isDisplaynameChange || */
                eventDiff.isAvatarChange))
        {
            return true;
        }

        if (syncedSettings['hideJoinLeaves'] && (eventDiff.isJoin || eventDiff.isPart)) return true;
        const isMemberAvatarDisplaynameChange = eventDiff.isAvatarChange || eventDiff.isDisplaynameChange;
        if (syncedSettings['hideAvatarDisplaynameChanges'] && isMemberAvatarDisplaynameChange) return true;
    }

    return false;
}
