/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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
import * as sdk from '../index';
import QueryMatcher from './QueryMatcher';
import _sortBy from 'lodash/sortBy';
import {MatrixClientPeg} from '../MatrixClientPeg';

import MatrixEvent from "matrix-js-sdk/src/models/event";
import Room from "matrix-js-sdk/src/models/room";
import RoomMember from "matrix-js-sdk/src/models/room-member";
import RoomState from "matrix-js-sdk/src/models/room-state";
import EventTimeline from "matrix-js-sdk/src/models/event-timeline";
import {makeUserPermalink} from "../utils/permalinks/Permalinks";
import {ICompletion, ISelectionRange} from "./Autocompleter";

const USER_REGEX = /\B@\S*/g;

// used when you hit 'tab' - we allow some separator chars at the beginning
// to allow you to tab-complete /mat into /(matthew)
const FORCED_USER_REGEX = /[^/,:; \t\n]\S*/g;

interface IRoomTimelineData {
    timeline: EventTimeline;
    liveEvent?: boolean;
}

export default class UserProvider extends AutocompleteProvider {
    matcher: QueryMatcher<RoomMember>;
    users: RoomMember[];
    room: Room;

    constructor(room: Room) {
        super(USER_REGEX, FORCED_USER_REGEX);
        this.room = room;
        this.matcher = new QueryMatcher([], {
            keys: ['name'],
            funcs: [obj => obj.userId.slice(1)], // index by user id minus the leading '@'
            shouldMatchPrefix: true,
            shouldMatchWordsOnly: false,
        });

        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("RoomState.members", this.onRoomStateMember);
    }

    destroy() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
        }
    }

    private onRoomTimeline = (ev: MatrixEvent, room: Room, toStartOfTimeline: boolean, removed: boolean,
                       data: IRoomTimelineData) => {
        if (!room) return;
        if (removed) return;
        if (room.roomId !== this.room.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // TODO: lazyload if we have no ev.sender room member?
        this.onUserSpoke(ev.sender);
    };

    private onRoomStateMember = (ev: MatrixEvent, state: RoomState, member: RoomMember) => {
        // ignore members in other rooms
        if (member.roomId !== this.room.roomId) {
            return;
        }

        // blow away the users cache
        this.users = null;
    };

    async getCompletions(rawQuery: string, selection: ISelectionRange, force = false): Promise<ICompletion[]> {
        const MemberAvatar = sdk.getComponent('views.avatars.MemberAvatar');

        // lazy-load user list into matcher
        if (!this.users) this._makeUsers();

        let completions = [];
        const {command, range} = this.getCurrentCommand(rawQuery, selection, force);

        if (!command) return completions;

        const fullMatch = command[0];
        // Don't search if the query is a single "@"
        if (fullMatch && fullMatch !== '@') {
            // Don't include the '@' in our search query - it's only used as a way to trigger completion
            const query = fullMatch.startsWith('@') ? fullMatch.substring(1) : fullMatch;
            completions = this.matcher.match(query).map((user) => {
                const displayName = (user.name || user.userId || '');
                return {
                    // Length of completion should equal length of text in decorator. draft-js
                    // relies on the length of the entity === length of the text in the decoration.
                    completion: user.rawDisplayName,
                    completionId: user.userId,
                    type: "user",
                    suffix: (selection.beginning && range.start === 0) ? ': ' : ' ',
                    href: makeUserPermalink(user.userId),
                    component: (
                        <PillCompletion title={displayName} description={user.userId}>
                            <MemberAvatar member={user} width={24} height={24} />
                        </PillCompletion>
                    ),
                    range,
                };
            });
        }
        return completions;
    }

    getName(): string {
        return '👥 ' + _t('Users');
    }

    _makeUsers() {
        const events = this.room.getLiveTimeline().getEvents();
        const lastSpoken = {};

        for (const event of events) {
            lastSpoken[event.getSender()] = event.getTs();
        }

        const currentUserId = MatrixClientPeg.get().credentials.userId;
        this.users = this.room.getJoinedMembers().filter(({userId}) => userId !== currentUserId);

        this.users = _sortBy(this.users, (member) => 1E20 - lastSpoken[member.userId] || 1E20);

        this.matcher.setObjects(this.users);
    }

    onUserSpoke(user: RoomMember) {
        if (!this.users) return;
        if (!user) return;
        if (user.userId === MatrixClientPeg.get().credentials.userId) return;

        // Move the user that spoke to the front of the array
        this.users.splice(
            this.users.findIndex((user2) => user2.userId === user.userId), 1);
        this.users = [user, ...this.users];

        this.matcher.setObjects(this.users);
    }

    renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div className="mx_Autocomplete_Completion_container_pill" role="listbox" aria-label={_t("User Autocomplete")}>
                { completions }
            </div>
        );
    }

    shouldForceComplete(): boolean {
        return true;
    }
}
