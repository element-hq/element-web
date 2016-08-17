import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import Fuse from 'fuse.js';
import {PillCompletion} from './Components';
import sdk from '../index';

const USER_REGEX = /@[^\s]*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super(USER_REGEX, {
            keys: ['name', 'userId'],
        });
        this.users = [];
        this.fuse = new Fuse([], {
            keys: ['name', 'userId'],
        });
    }

    getCompletions(query: string, selection: {start: number, end: number}) {
        const MemberAvatar = sdk.getComponent('views.avatars.MemberAvatar');

        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            this.fuse.set(this.users);
            completions = this.fuse.search(command[0]).map(user => {
                const displayName = (user.name || user.userId || '').replace(' (IRC)', ''); // FIXME when groups are done
                return {
                    completion: user.userId,
                    component: (
                        <PillCompletion
                            initialComponent={<MemberAvatar member={user} width={24} height={24}/>}
                            title={displayName}
                            description={user.userId} />
                    ),
                    range
                };
            }).slice(0, 4);
        }
        return Q.when(completions);
    }

    getName() {
        return '👥 Users';
    }

    setUserList(users) {
        this.users = users;
    }

    static getInstance(): UserProvider {
        if (instance == null) {
            instance = new UserProvider();
        }
        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return React.cloneElement(super.renderCompletions(completions), {
            className: 'mx_Autocomplete_Completion_container_pill',
        });
    }
}
