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
import Room from "matrix-js-sdk/src/models/room";
import { _t } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';
import {MatrixClientPeg} from '../MatrixClientPeg';
import QueryMatcher from './QueryMatcher';
import {PillCompletion} from './Components';
import * as sdk from '../index';
import {makeRoomPermalink} from "../utils/permalinks/Permalinks";
import {ICompletion, ISelectionRange} from "./Autocompleter";
import { uniqBy, sortBy } from 'lodash';

const ROOM_REGEX = /\B#\S*/g;

function score(query: string, space: string) {
    const index = space.indexOf(query);
    if (index === -1) {
        return Infinity;
    } else {
        return index;
    }
}

function matcherObject(room: Room, displayedAlias: string, matchName = "") {
    return {
        room,
        matchName,
        displayedAlias,
    };
}

export default class RoomProvider extends AutocompleteProvider {
    matcher: QueryMatcher<Room>;

    constructor() {
        super(ROOM_REGEX);
        this.matcher = new QueryMatcher([], {
            keys: ['displayedAlias', 'matchName'],
        });
    }

    async getCompletions(query: string, selection: ISelectionRange, force = false): Promise<ICompletion[]> {
        const RoomAvatar = sdk.getComponent('views.avatars.RoomAvatar');

        const client = MatrixClientPeg.get();
        let completions = [];
        const {command, range} = this.getCurrentCommand(query, selection, force);
        if (command) {
            // the only reason we need to do this is because Fuse only matches on properties
            let matcherObjects = client.getVisibleRooms().reduce((aliases, room) => {
                if (room.getCanonicalAlias()) {
                    aliases = aliases.concat(matcherObject(room, room.getCanonicalAlias(), room.name));
                }
                if (room.getAltAliases().length) {
                    const altAliases = room.getAltAliases().map(alias => matcherObject(room, alias));
                    aliases = aliases.concat(altAliases);
                }
                return aliases;
            }, []);
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
            completions = sortBy(completions, [
                (c) => score(matchedString, c.displayedAlias),
                (c) => c.displayedAlias.length,
            ]);
            completions = uniqBy(completions, (match) => match.room);
            completions = completions.map((room) => {
                return {
                    completion: room.displayedAlias,
                    completionId: room.room.roomId,
                    type: "room",
                    suffix: ' ',
                    href: makeRoomPermalink(room.displayedAlias),
                    component: (
                        <PillCompletion title={room.room.name} description={room.displayedAlias}>
                            <RoomAvatar width={24} height={24} room={room.room} />
                        </PillCompletion>
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

    renderCompletions(completions: React.ReactNode[]): React.ReactNode {
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
