import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import MatrixClientPeg from '../MatrixClientPeg';

const ROOM_REGEX = /@[^\s]*/g;

export default class UserProvider extends AutocompleteProvider {
    constructor() {
        super();
    }

    getCompletions(query: String) {
        let client = MatrixClientPeg.get();
        let completions = [];
        const matches = query.match(ROOM_REGEX);
        if(!!matches) {
            const command = matches[0];
            completions = client.getUsers().map(user => {
                return {
                    title: user.displayName,
                    description: user.userId
                };
            });
        }
        return Q.when(completions);
    }

    getName() {
        return 'Users';
    }
}
