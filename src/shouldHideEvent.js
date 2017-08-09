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

function _isLeaveOrJoin(ev) {
    const isMemberEvent = ev.getType() === 'm.room.member' && ev.getStateKey() !== undefined;
    if (!isMemberEvent) {
        return false; // bail early: all the checks below concern member events only
    }

    // TODO: These checks are done to make sure we're dealing with membership transitions not avatar changes / dupe joins
    //       These checks are also being done in TextForEvent and should really reside in the JS SDK as a helper function
    const membership = ev.getContent().membership;
    const prevMembership = ev.getPrevContent().membership;
    if (membership === prevMembership && membership === 'join') {
        // join -> join : This happens when display names change / avatars are set / genuine dupe joins with no changes.
        //                Find out which we're dealing with.
        if (ev.getPrevContent().displayname !== ev.getContent().displayname) {
            return false; // display name changed
        }
        if (ev.getPrevContent().avatar_url !== ev.getContent().avatar_url) {
            return false; // avatar url changed
        }
        // dupe join event, fall through to hide rules
    }


    // this only applies to joins/invited joins/leaves not invites/kicks/bans
    const isJoin = membership === 'join' && prevMembership !== 'ban';
    const isLeave = membership === 'leave' && ev.getStateKey() === ev.getSender();
    return isJoin || isLeave;
}

export default function(ev, syncedSettings) {
    // Hide redacted events
    if (syncedSettings['hideRedactions'] && ev.isRedacted()) return true;
    if (syncedSettings['hideJoinLeaves'] && _isLeaveOrJoin(ev)) return true;
    return false;
}
