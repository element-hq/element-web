import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import Fuse from 'fuse.js';

const ROOM_REGEX = /@[^\s]*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super();
        this.users = [];
        this.fuse = new Fuse([], {
            keys: ['displayName', 'userId']
        })
    }

    getCompletions(query: String) {
        let completions = [];
        let matches = query.match(ROOM_REGEX);
        let command = matches && matches[0];
        if(command) {
            this.fuse.set(this.users);
            completions = this.fuse.search(command).map(user => {
                return {
                    title: user.displayName || user.userId,
                    description: user.userId
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
        if(instance == null)
            instance = new UserProvider();
        return instance;
    }
}
