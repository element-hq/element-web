import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import {PillCompletion} from './Components';
import sdk from '../index';
import FuzzyMatcher from './FuzzyMatcher';

const USER_REGEX = /@\S*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super(USER_REGEX, {
            keys: ['name', 'userId'],
        });
        this.users = [];
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

    setUserList(users) {
        this.users = users;
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
