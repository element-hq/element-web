/*
Copyright 2017 New Vector Ltd

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
import AutocompleteProvider from './AutocompleteProvider';
import { _t } from '../languageHandler';
import {MatrixClientPeg} from '../MatrixClientPeg';
import {PillCompletion} from './Components';
import * as sdk from '../index';
import {ICompletion, ISelectionRange} from "./Autocompleter";

const AT_ROOM_REGEX = /@\S*/g;

export default class NotifProvider extends AutocompleteProvider {
    room: Room;

    constructor(room) {
        super(AT_ROOM_REGEX);
        this.room = room;
    }

    async getCompletions(query: string, selection: ISelectionRange, force= false): Promise<ICompletion[]> {
        const RoomAvatar = sdk.getComponent('views.avatars.RoomAvatar');

        const client = MatrixClientPeg.get();

        if (!this.room.currentState.mayTriggerNotifOfType('room', client.credentials.userId)) return [];

        const {command, range} = this.getCurrentCommand(query, selection, force);
        if (command && command[0] && '@room'.startsWith(command[0]) && command[0].length > 1) {
            return [{
                completion: '@room',
                completionId: '@room',
                type: "at-room",
                suffix: ' ',
                component: (
                    <PillCompletion title="@room" description={_t("Notify the whole room")}>
                        <RoomAvatar width={24} height={24} room={this.room} />
                    </PillCompletion>
                ),
                range,
            }];
        }
        return [];
    }

    getName() {
        return '❗️ ' + _t('Room Notification');
    }

    renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="listbox"
                aria-label={_t("Notification Autocomplete")}
            >
                { completions }
            </div>
        );
    }
}
