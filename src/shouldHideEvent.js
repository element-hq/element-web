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
        if (syncedSettings['hideJoinLeaves'] && (eventDiff.isJoin || eventDiff.isPart)) return true;
        const isMemberAvatarDisplaynameChange = eventDiff.isAvatarChange || eventDiff.isDisplaynameChange;
        if (syncedSettings['hideAvatarDisplaynameChanges'] && isMemberAvatarDisplaynameChange) return true;
    }

    return false;
}
