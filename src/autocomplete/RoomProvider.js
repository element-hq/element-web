/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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
import {MatrixClientPeg} from '../MatrixClientPeg';
import QueryMatcher from './QueryMatcher';
import {PillCompletion} from './Components';
import {getDisplayAliasForRoom} from '../Rooms';
import * as sdk from '../index';
import _sortBy from 'lodash/sortBy';
import {makeRoomPermalink} from "../utils/permalinks/Permalinks";
import type {Completion, SelectionRange} from "./Autocompleter";

const ROOM_REGEX = /\B#\S*/g;

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
        this.matcher = new QueryMatcher([], {
            keys: ['displayedAlias', 'name'],
        });
    }

    async getCompletions(query: string, selection: SelectionRange, force: boolean = false): Array<Completion> {
        const RoomAvatar = sdk.getComponent('views.avatars.RoomAvatar');

        const client = MatrixClientPeg.get();
        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection, force);
        if (command) {
            // the only reason we need to do this is because Fuse only matches on properties
            let matcherObjects = client.getVisibleRooms().filter(
                (room) => !!room && !!getDisplayAliasForRoom(room),
            ).map((room) => {
                return {
                    room: room,
                    name: room.name,
                    displayedAlias: getDisplayAliasForRoom(room),
                };
            });

            // Filter out any matches where the user will have also autocompleted new rooms
            matcherObjects = matcherObjects.filter((r) => {
                const tombstone = r.room.currentState.getStateEvents("m.room.tombstone", "");
                if (tombstone && tombstone.getContent() && tombstone.getContent()['replacement_room']) {
                    const hasReplacementRoom = matcherObjects.some(
                        (r2) => r2.room.roomId === tombstone.getContent()['replacement_room'],
                    );
                    return !hasReplacementRoom;
                }
                return true;
            });

            this.matcher.setObjects(matcherObjects);
            const matchedString = command[0];
            completions = this.matcher.match(matchedString);
            completions = _sortBy(completions, [
                (c) => score(matchedString, c.displayedAlias),
                (c) => c.displayedAlias.length,
            ]).map((room) => {
                const displayAlias = getDisplayAliasForRoom(room.room) || room.roomId;
                return {
                    completion: displayAlias,
                    completionId: displayAlias,
                    type: "room",
                    suffix: ' ',
                    href: makeRoomPermalink(displayAlias),
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

    renderCompletions(completions: [React.Component]): ?React.Component {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="listbox"
                aria-label={_t("Room Autocomplete")}
            >
                { completions }
            </div>
        );
    }
}
