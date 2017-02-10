//@flow
import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import {PillCompletion} from './Components';
import sdk from '../index';
import FuzzyMatcher from './FuzzyMatcher';
import _pull from 'lodash/pull';
import _sortBy from 'lodash/sortBy';
import MatrixClientPeg from '../MatrixClientPeg';

import type {Room, RoomMember} from 'matrix-js-sdk';

const USER_REGEX = /@\S*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    users: Array<RoomMember> = [];

    constructor() {
        super(USER_REGEX, {
            keys: ['name', 'userId'],
        });
        this.matcher = new FuzzyMatcher([], {
            keys: ['name', 'userId'],
        });
    }

    async getCompletions(query: string, selection: {start: number, end: number}, force = false) {
        const MemberAvatar = sdk.getComponent('views.avatars.MemberAvatar');

        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection, force);
        if (command) {
            completions = this.matcher.match(command[0]).map(user => {
                let displayName = (user.name || user.userId || '').replace(' (IRC)', ''); // FIXME when groups are done
                let completion = displayName;
                if (range.start === 0) {
                    completion += ': ';
                } else {
                    completion += ' ';
                }
                return {
                    completion,
                    component: (
                        <PillCompletion
                            initialComponent={<MemberAvatar member={user} width={24} height={24}/>}
                            title={displayName}
                            description={user.userId} />
                    ),
                    range,
                };
            }).slice(0, 4);
        }
        return completions;
    }

    getName() {
        return '👥 Users';
    }

    setUserListFromRoom(room: Room) {
        const events = room.getLiveTimeline().getEvents();
        const lastSpoken = {};

        for(const event of events) {
            lastSpoken[event.getSender()] = event.getTs();
        }

        const currentUserId = MatrixClientPeg.get().credentials.userId;
        this.users = room.getJoinedMembers().filter((member) => {
            if (member.userId !== currentUserId) return true;
        });

        this.users = _sortBy(this.users, (user) => 1E20 - lastSpoken[user.userId] || 1E20);

        this.matcher.setObjects(this.users);
    }

    onUserSpoke(user: RoomMember) {
        if(user.userId === MatrixClientPeg.get().credentials.userId) return;

        // Probably unsafe to compare by reference here?
        _pull(this.users, user);
        this.users.splice(0, 0, user);
        this.matcher.setObjects(this.users);
    }

    static getInstance(): UserProvider {
        if (instance == null) {
            instance = new UserProvider();
        }
        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill">
            {completions}
        </div>;
    }

    shouldForceComplete(): boolean {
        return true;
    }
}
