/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactElement, type RefAttributes, type HTMLAttributes } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import CommandProvider from "./CommandProvider";
import RoomProvider from "./RoomProvider";
import UserProvider from "./UserProvider";
import EmojiProvider from "./EmojiProvider";
import NotifProvider from "./NotifProvider";
import { timeout } from "../utils/promise";
import { type ICommand } from "./AutocompleteProvider";
import type AutocompleteProvider from "./AutocompleteProvider";
import SpaceProvider from "./SpaceProvider";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { filterBoolean } from "../utils/arrays";

export interface ISelectionRange {
    beginning?: boolean; // whether the selection is in the first block of the editor or not
    start: number; // byte offset relative to the start anchor of the current editor selection.
    end: number; // byte offset relative to the end anchor of the current editor selection.
}

export interface ICompletion {
    type?: "at-room" | "command" | "community" | "room" | "user";
    completion: string;
    completionId?: string;
    component: ReactElement<RefAttributes<HTMLElement> & HTMLAttributes<HTMLElement>>;
    range: ISelectionRange;
    command?: string;
    suffix?: string;
    // If provided, apply a LINK entity to the completion with the
    // data = { url: href }.
    href?: string;
}

const PROVIDERS = [UserProvider, RoomProvider, EmojiProvider, NotifProvider, CommandProvider, SpaceProvider];

// Providers will get rejected if they take longer than this.
const PROVIDER_COMPLETION_TIMEOUT = 3000;

export interface IProviderCompletions {
    completions: ICompletion[];
    provider: AutocompleteProvider;
    command: Partial<ICommand>;
}

export default class Autocompleter {
    public room: Room;
    public providers: AutocompleteProvider[];

    public constructor(room: Room, renderingType: TimelineRenderingType = TimelineRenderingType.Room) {
        this.room = room;
        this.providers = PROVIDERS.map((Prov) => {
            return new Prov(room, renderingType);
        });
    }

    public destroy(): void {
        this.providers.forEach((p) => {
            p.destroy();
        });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force = false,
        limit = -1,
    ): Promise<IProviderCompletions[]> {
        /* Note: This intentionally waits for all providers to return,
         otherwise, we run into a condition where new completions are displayed
         while the user is interacting with the list, which makes it difficult
         to predict whether an action will actually do what is intended
        */
        // list of results from each provider, each being a list of completions or null if it times out
        const completionsList: Array<ICompletion[] | null> = await Promise.all(
            this.providers.map(async (provider): Promise<ICompletion[] | null> => {
                return timeout(
                    provider.getCompletions(query, selection, force, limit),
                    null,
                    PROVIDER_COMPLETION_TIMEOUT,
                );
            }),
        );

        // map then filter to maintain the index for the map-operation, for this.providers to line up
        return filterBoolean(
            completionsList.map((completions, i) => {
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
            }),
        );
    }
}
