import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import MatrixClientPeg from '../MatrixClientPeg';
import Fuse from 'fuse.js';

const ROOM_REGEX = /(?=#)[^\s]*/g;

let instance = null;

export default class RoomProvider extends AutocompleteProvider {
    constructor() {
        super();
    }

    getCompletions(query: String) {
        let client = MatrixClientPeg.get();
        let completions = [];
        const matches = query.match(ROOM_REGEX);
        const command = matches && matches[0];
        if(command) {
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
    
    static getInstance() {
        if(instance == null)
            instance = new RoomProvider();
        
        return instance;
    }
}
