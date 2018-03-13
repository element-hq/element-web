//@flow
/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
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

import React from 'react';
import { _t } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import {PillCompletion} from './Components';
import sdk from '../index';
import FuzzyMatcher from './FuzzyMatcher';
import _pull from 'lodash/pull';
import _sortBy from 'lodash/sortBy';
import MatrixClientPeg from '../MatrixClientPeg';

import type {Room, RoomMember} from 'matrix-js-sdk';
import {makeUserPermalink} from "../matrix-to";

const USER_REGEX = /@\S*/g;

export default class UserProvider extends AutocompleteProvider {
    users: Array<RoomMember> = null;
    room: Room = null;

    constructor(room) {
        super(USER_REGEX, {
            keys: ['name'],
        });
        this.room = room;
        this.matcher = new FuzzyMatcher([], {
            keys: ['name', 'userId'],
            shouldMatchPrefix: true,
            shouldMatchWordsOnly: false
        });

        this._onRoomTimelineBound = this._onRoomTimeline.bind(this);
        this._onRoomStateMemberBound = this._onRoomStateMember.bind(this);

        MatrixClientPeg.get().on("Room.timeline", this._onRoomTimelineBound);
        MatrixClientPeg.get().on("RoomState.members", this._onRoomStateMemberBound);
    }

    destroy() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this._onRoomTimelineBound);
            MatrixClientPeg.get().removeListener("RoomState.members", this._onRoomStateMemberBound);
        }
    }

    _onRoomTimeline(ev, room, toStartOfTimeline, removed, data) {
        if (!room) return;
        if (removed) return;
        if (room.roomId !== this.room.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        this.onUserSpoke(ev.sender);
    }

    _onRoomStateMember(ev, state, member) {
        // ignore members in other rooms
        if (member.roomId !== this.room.roomId) {
            return;
        }

        // blow away the users cache
        this.users = null;
    }

    async getCompletions(query: string, selection: {start: number, end: number}, force = false) {
        const MemberAvatar = sdk.getComponent('views.avatars.MemberAvatar');

        // Disable autocompletions when composing commands because of various issues
        // (see https://github.com/vector-im/riot-web/issues/4762)
        if (/^(\/ban|\/unban|\/op|\/deop|\/invite|\/kick|\/verify)/.test(query)) {
            return [];
        }

        // lazy-load user list into matcher
        if (this.users === null) this._makeUsers();

        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection, force);
        if (command) {
            completions = this.matcher.match(command[0]).map((user) => {
                const displayName = (user.name || user.userId || '').replace(' (IRC)', ''); // FIXME when groups are done
                return {
                    // Length of completion should equal length of text in decorator. draft-js
                    // relies on the length of the entity === length of the text in the decoration.
                    completion: user.rawDisplayName.replace(' (IRC)', ''),
                    suffix: range.start === 0 ? ': ' : ' ',
                    href: makeUserPermalink(user.userId),
                    component: (
                        <PillCompletion
                            initialComponent={<MemberAvatar member={user} width={24} height={24} />}
                            title={displayName}
                            description={user.userId} />
                    ),
                    range,
                };
            });
        }
        return completions;
    }

    getName() {
        return '👥 ' + _t('Users');
    }

    _makeUsers() {
        const events = this.room.getLiveTimeline().getEvents();
        const lastSpoken = {};

        for (const event of events) {
            lastSpoken[event.getSender()] = event.getTs();
        }

        const currentUserId = MatrixClientPeg.get().credentials.userId;
        this.users = this.room.getJoinedMembers().filter((member) => {
            if (member.userId !== currentUserId) return true;
        });

        this.users = _sortBy(this.users, (member) =>
            1E20 - lastSpoken[member.userId] || 1E20,
        );

        this.matcher.setObjects(this.users);
    }

    onUserSpoke(user: RoomMember) {
        if (this.users === null) return;
        if (user.userId === MatrixClientPeg.get().credentials.userId) return;

        // Move the user that spoke to the front of the array
        this.users.splice(
            this.users.findIndex((user2) => user2.userId === user.userId), 1);
        this.users = [user, ...this.users];

        this.matcher.setObjects(this.users);
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill">
            { completions }
        </div>;
    }

    shouldForceComplete(): boolean {
        return true;
    }
}
