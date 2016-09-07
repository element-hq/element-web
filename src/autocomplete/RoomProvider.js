import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import MatrixClientPeg from '../MatrixClientPeg';
import Fuse from 'fuse.js';
import {PillCompletion} from './Components';
import {getDisplayAliasForRoom} from '../Rooms';
import sdk from '../index';

const ROOM_REGEX = /(?=#)([^\s]*)/g;

let instance = null;

export default class RoomProvider extends AutocompleteProvider {
    constructor() {
        super(ROOM_REGEX, {
            keys: ['displayName', 'userId'],
        });
        this.fuse = new Fuse([], {
           keys: ['name', 'roomId', 'aliases'],
        });
    }

    getCompletions(query: string, selection: {start: number, end: number}) {
        const RoomAvatar = sdk.getComponent('views.avatars.RoomAvatar');

        let client = MatrixClientPeg.get();
        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            // the only reason we need to do this is because Fuse only matches on properties
            this.fuse.set(client.getRooms().filter(room => !!room).map(room => {
                return {
                    room: room,
                    name: room.name,
                    roomId: room.roomId,
                    aliases: room.getAliases(),
                };
            }));
            completions = this.fuse.search(command[0]).map(room => {
                let displayAlias = getDisplayAliasForRoom(room.room) || room.roomId;
                return {
                    completion: displayAlias,
                    component: (
                        <PillCompletion initialComponent={<RoomAvatar width={24} height={24} room={room.room} />} title={room.name} description={displayAlias} />
                    ),
                    range,
                };
            }).slice(0, 4);
        }
        return Q.when(completions);
    }

    getName() {
        return '💬 Rooms';
    }
    
    static getInstance() {
        if (instance == null) {
            instance = new RoomProvider();
        }
        
        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill">
            {completions}
        </div>;
    }
}
