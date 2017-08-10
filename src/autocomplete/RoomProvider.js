/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import { _t } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import MatrixClientPeg from '../MatrixClientPeg';
import FuzzyMatcher from './FuzzyMatcher';
import {PillCompletion} from './Components';
import {getDisplayAliasForRoom} from '../Rooms';
import sdk from '../index';
import _sortBy from 'lodash/sortBy';

const ROOM_REGEX = /(?=#)(\S*)/g;

let instance = null;

function score(query, space) {
    const index = space.indexOf(query);
    if (index === -1) {
        return Infinity;
    } else {
        return index;
    }
}

export default class RoomProvider extends AutocompleteProvider {
    constructor() {
        super(ROOM_REGEX);
        this.matcher = new FuzzyMatcher([], {
            keys: ['displayedAlias', 'name'],
        });
    }

    async getCompletions(query: string, selection: {start: number, end: number}, force = false) {
        const RoomAvatar = sdk.getComponent('views.avatars.RoomAvatar');

        // Disable autocompletions when composing commands because of various issues
        // (see https://github.com/vector-im/riot-web/issues/4762)
        if (/^(\/join|\/leave)/.test(query)) {
            return [];
        }

        const client = MatrixClientPeg.get();
        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection, force);
        if (command) {
            // the only reason we need to do this is because Fuse only matches on properties
            this.matcher.setObjects(client.getRooms().filter(
                (room) => !!room && !!getDisplayAliasForRoom(room),
            ).map((room) => {
                return {
                    room: room,
                    name: room.name,
                    displayedAlias: getDisplayAliasForRoom(room),
                };
            }));
            const matchedString = command[0];
            completions = this.matcher.match(matchedString);
            completions = _sortBy(completions, [
                (c) => score(matchedString, c.displayedAlias),
                (c) => c.displayedAlias.length,
            ]).map((room) => {
                const displayAlias = getDisplayAliasForRoom(room.room) || room.roomId;
                return {
                    completion: displayAlias,
                    suffix: ' ',
                    href: 'https://matrix.to/#/' + displayAlias,
                    component: (
                        <PillCompletion initialComponent={<RoomAvatar width={24} height={24} room={room.room} />} title={room.name} description={displayAlias} />
                    ),
                    range,
                };
            })
            .filter((completion) => !!completion.completion && completion.completion.length > 0)
            .slice(0, 4);
        }
        return completions;
    }

    getName() {
        return '💬 ' + _t('Rooms');
    }

    static getInstance() {
        if (instance == null) {
            instance = new RoomProvider();
        }

        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate">
            {completions}
        </div>;
    }
}
