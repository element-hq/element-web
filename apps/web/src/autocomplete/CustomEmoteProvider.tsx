/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { PillCompletion } from "./Components";
import AutocompleteProvider from "./AutocompleteProvider";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import { type TimelineRenderingType } from "../contexts/RoomContext";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { mediaFromMxc } from "../customisations/Media";
import { getCustomEmotesForRoom } from "../custom-emotes";
import { _t } from "../languageHandler";

const LIMIT = 20;
const CUSTOM_EMOTE_REGEX = /(?:^|\s):[A-Za-z0-9_\-/]*:?$/g;

export default class CustomEmoteProvider extends AutocompleteProvider {
    public constructor(
        private readonly room: Room,
        renderingType?: TimelineRenderingType,
    ) {
        super({ commandRegex: CUSTOM_EMOTE_REGEX, renderingType });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force?: boolean,
        limit = LIMIT,
    ): Promise<ICompletion[]> {
        const { command, range } = this.getCurrentCommand(query, selection, force);
        if (!command || !range) return [];

        const matchedString = command[0].trim();
        const search = matchedString.replace(/^:/, "").replace(/:$/, "").toLowerCase();
        if (!search) return [];

        const emotes = getCustomEmotesForRoom(MatrixClientPeg.safeGet(), this.room)
            .map((emote, index) => ({ emote, index }))
            .filter(({ emote }) => emote.shortcode.toLowerCase().includes(search))
            .sort((a, b) => {
                const aExact = a.emote.shortcode.toLowerCase() === search ? 0 : 1;
                const bExact = b.emote.shortcode.toLowerCase() === search ? 0 : 1;
                if (aExact !== bExact) return aExact - bExact;

                const aPrefix = a.emote.shortcode.toLowerCase().startsWith(search) ? 0 : 1;
                const bPrefix = b.emote.shortcode.toLowerCase().startsWith(search) ? 0 : 1;
                if (aPrefix !== bPrefix) return aPrefix - bPrefix;
                if (a.emote.shortcode.length !== b.emote.shortcode.length) {
                    return a.emote.shortcode.length - b.emote.shortcode.length;
                }
                const shortcodeOrder = a.emote.shortcode.localeCompare(b.emote.shortcode);
                return shortcodeOrder || a.index - b.index;
            })
            .slice(0, limit < 0 ? LIMIT : Math.min(limit, LIMIT))
            .map(({ emote }) => emote);

        return emotes.map((emote) => ({
            type: "custom-emote",
            completion: emote.sendToken,
            completionId: `${emote.pack.roomId}\u0000${emote.pack.stateKey}\u0000${emote.shortcode}`,
            component: (
                <PillCompletion title={`:${emote.shortcode}:`} subtitle={emote.pack.displayName}>
                    <img
                        className="mx_Autocomplete_Completion_customEmote"
                        src={mediaFromMxc(emote.url).srcHttp ?? undefined}
                        alt={emote.body || emote.shortcode}
                    />
                </PillCompletion>
            ),
            range,
            customEmote: {
                shortcode: emote.shortcode,
                url: emote.url,
                body: emote.body,
            },
        }));
    }

    public getName(): string {
        return _t("common|custom_emotes");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return <div className="mx_Autocomplete_Completion_container_pill">{completions}</div>;
    }
}
