import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import MatrixClientPeg from '../MatrixClientPeg';

const ROOM_REGEX = /@[^\s]*/g;

let instance = null;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super();
        this.users = [];
    }

    getCompletions(query: String) {
        let completions = [];
        const matches = query.match(ROOM_REGEX);
        if(!!matches) {
            const command = matches[0];
            completions = this.users.map(user => {
                return {
                    title: user.displayName || user.userId,
                    description: user.userId
                };
            });
        }
        return Q.when(completions);
    }

    getName() {
        return 'Users';
    }

    setUserList(users) {
        console.log('setUserList');
        this.users = users;
    }

    static getInstance(): UserProvider {
        if(instance == null)
            instance = new UserProvider();
        return instance;
    }
}
