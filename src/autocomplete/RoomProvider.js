import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import MatrixClientPeg from '../MatrixClientPeg';

const ROOM_REGEX = /(?=#)[^\s]*/g;

export default class RoomProvider extends AutocompleteProvider {
    constructor() {
        super();
    }

    getCompletions(query: String) {
        let client = MatrixClientPeg.get();
        let completions = [];
        const matches = query.match(ROOM_REGEX);
        if(!!matches) {
            const command = matches[0];
            completions = client.getRooms().map(room => {
                return {
                    title: room.name,
                    subtitle: room.roomId
                };
            });
        }
        return Q.when(completions);
    }

    getName() {
        return 'Rooms';
    }
}
