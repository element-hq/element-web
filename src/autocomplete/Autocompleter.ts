/*
Copyright 2016 Aviral Dasgupta
Copyright 2017, 2018 New Vector Ltd

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

import {ReactElement} from 'react';
import Room from 'matrix-js-sdk/src/models/room';
import CommandProvider from './CommandProvider';
import CommunityProvider from './CommunityProvider';
import DuckDuckGoProvider from './DuckDuckGoProvider';
import RoomProvider from './RoomProvider';
import UserProvider from './UserProvider';
import EmojiProvider from './EmojiProvider';
import NotifProvider from './NotifProvider';
import {timeout} from "../utils/promise";
import AutocompleteProvider, {ICommand} from "./AutocompleteProvider";

export interface ISelectionRange {
    beginning?: boolean; // whether the selection is in the first block of the editor or not
    start: number; // byte offset relative to the start anchor of the current editor selection.
    end: number; // byte offset relative to the end anchor of the current editor selection.
}

export interface ICompletion {
    type: "at-room" | "command" | "community" | "room" | "user";
    completion: string;
    completionId?: string;
    component?: ReactElement;
    range: ISelectionRange;
    command?: string;
    suffix?: string;
    // If provided, apply a LINK entity to the completion with the
    // data = { url: href }.
    href?: string;
}

const PROVIDERS = [
    UserProvider,
    RoomProvider,
    EmojiProvider,
    NotifProvider,
    CommandProvider,
    CommunityProvider,
    DuckDuckGoProvider,
];

// Providers will get rejected if they take longer than this.
const PROVIDER_COMPLETION_TIMEOUT = 3000;

export interface IProviderCompletions {
    completions: ICompletion[];
    provider: AutocompleteProvider;
    command: ICommand;
}

export default class Autocompleter {
    room: Room;
    providers: AutocompleteProvider[];

    constructor(room: Room) {
        this.room = room;
        this.providers = PROVIDERS.map((Prov) => {
            return new Prov(room);
        });
    }

    destroy() {
        this.providers.forEach((p) => {
            p.destroy();
        });
    }

    async getCompletions(query: string, selection: ISelectionRange, force = false): Promise<IProviderCompletions[]> {
        /* Note: This intentionally waits for all providers to return,
         otherwise, we run into a condition where new completions are displayed
         while the user is interacting with the list, which makes it difficult
         to predict whether an action will actually do what is intended
        */
        // list of results from each provider, each being a list of completions or null if it times out
        const completionsList: ICompletion[][] = await Promise.all(this.providers.map(provider => {
            return timeout(provider.getCompletions(query, selection, force), null, PROVIDER_COMPLETION_TIMEOUT);
        }));

        // map then filter to maintain the index for the map-operation, for this.providers to line up
        return completionsList.map((completions, i) => {
            if (!completions || !completions.length) return;

            return {
                completions,
                provider: this.providers[i],

                /* the currently matched "command" the completer tried to complete
                 * we pass this through so that Autocomplete can figure out when to
                 * re-show itself once hidden.
                 */
                command: this.providers[i].getCurrentCommand(query, selection, force),
            };
        }).filter(Boolean);
    }
}
