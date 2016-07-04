import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import Fuse from 'fuse.js';
import {TextualCompletion} from './Components';

const USER_REGEX = /@[^\s]*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super(USER_REGEX, {
            keys: ['displayName', 'userId'],
        });
        this.users = [];
        this.fuse = new Fuse([], {
            keys: ['displayName', 'userId'],
        });
    }

    getCompletions(query: string, selection: {start: number, end: number}) {
        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            this.fuse.set(this.users);
            completions = this.fuse.search(command[0]).map(user => {
                return {
                    completion: user.userId,
                    component: (
                        <TextualCompletion
                            title={user.displayName || user.userId}
                            description={user.userId} />
                    ),
                    range
                };
            }).slice(0, 4);
        }
        return Q.when(completions);
    }

    getName() {
        return 'Users';
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
}
