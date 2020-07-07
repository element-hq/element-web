/*
Copyright 2017 New Vector Ltd

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

import PropTypes from 'prop-types';

import { _t } from './languageHandler';

export const GroupMemberType = PropTypes.shape({
    userId: PropTypes.string.isRequired,
    displayname: PropTypes.string,
    avatarUrl: PropTypes.string,
});

export const GroupRoomType = PropTypes.shape({
    displayname: PropTypes.string,
    name: PropTypes.string,
    roomId: PropTypes.string.isRequired,
    canonicalAlias: PropTypes.string,
    avatarUrl: PropTypes.string,
});

export function groupMemberFromApiObject(apiObject) {
    return {
        userId: apiObject.user_id,
        displayname: apiObject.displayname,
        avatarUrl: apiObject.avatar_url,
        isPrivileged: apiObject.is_privileged,
    };
}

export function groupRoomFromApiObject(apiObject) {
    return {
        displayname: apiObject.name || apiObject.canonical_alias || _t("Unnamed Room"),
        name: apiObject.name,
        roomId: apiObject.room_id,
        canonicalAlias: apiObject.canonical_alias,
        avatarUrl: apiObject.avatar_url,
        topic: apiObject.topic,
        numJoinedMembers: apiObject.num_joined_members,
        worldReadable: apiObject.world_readable,
        guestCanJoin: apiObject.guest_can_join,
        isPublic: apiObject.is_public !== false,
    };
}
