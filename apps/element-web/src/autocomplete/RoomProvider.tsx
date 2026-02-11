/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2023 The Matrix.org Foundation C.I.C.
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sortBy, uniqBy } from "lodash";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../languageHandler";
import AutocompleteProvider from "./AutocompleteProvider";
import { MatrixClientPeg } from "../MatrixClientPeg";
import QueryMatcher from "./QueryMatcher";
import { PillCompletion } from "./Components";
import { makeRoomPermalink } from "../utils/permalinks/Permalinks";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { type TimelineRenderingType } from "../contexts/RoomContext";
import SettingsStore from "../settings/SettingsStore";

const ROOM_REGEX = /\B#\S*/g;

// Prefer canonical aliases over non-canonical ones
function canonicalScore(displayedAlias: string, room: Room): number {
    return displayedAlias === room.getCanonicalAlias() ? 0 : 1;
}

function matcherObject(
    room: Room,
    displayedAlias: string,
    matchName = "",
): {
    room: Room;
    matchName: string;
    displayedAlias: string;
} {
    return {
        room,
        matchName,
        displayedAlias,
    };
}

export default class RoomProvider extends AutocompleteProvider {
    protected matcher: QueryMatcher<ReturnType<typeof matcherObject>>;

    public constructor(
        private readonly room: Room,
        renderingType?: TimelineRenderingType,
    ) {
        super({ commandRegex: ROOM_REGEX, renderingType });
        this.matcher = new QueryMatcher<ReturnType<typeof matcherObject>>([], {
            keys: ["displayedAlias", "matchName"],
        });
    }

    protected getRooms(): Room[] {
        const cli = MatrixClientPeg.safeGet();

        // filter out spaces here as they get their own autocomplete provider
        return cli
            .getVisibleRooms(SettingsStore.getValue("feature_dynamic_room_predecessors"))
            .filter((r) => !r.isSpaceRoom());
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force = false,
        limit = -1,
    ): Promise<ICompletion[]> {
        const { command, range } = this.getCurrentCommand(query, selection, force);
        if (command) {
            // the only reason we need to do this is because Fuse only matches on properties
            let matcherObjects = this.getRooms().reduce<ReturnType<typeof matcherObject>[]>((aliases, room) => {
                if (room.getCanonicalAlias()) {
                    aliases = aliases.concat(matcherObject(room, room.getCanonicalAlias()!, room.name));
                }
                if (room.getAltAliases().length) {
                    const altAliases = room.getAltAliases().map((alias) => matcherObject(room, alias));
                    aliases = aliases.concat(altAliases);
                }
                return aliases;
            }, []);
            // Filter out any matches where the user will have also autocompleted new rooms
            matcherObjects = matcherObjects.filter((r) => {
                const tombstone = r.room.currentState.getStateEvents("m.room.tombstone", "");
                if (tombstone && tombstone.getContent() && tombstone.getContent()["replacement_room"]) {
                    const hasReplacementRoom = matcherObjects.some(
                        (r2) => r2.room.roomId === tombstone.getContent()["replacement_room"],
                    );
                    return !hasReplacementRoom;
                }
                return true;
            });

            this.matcher.setObjects(matcherObjects);
            const matchedString = command[0];
            let completions = this.matcher.match(matchedString, limit);
            completions = sortBy(completions, [
                (c) => canonicalScore(c.displayedAlias, c.room),
                (c) => c.displayedAlias.length,
            ]);
            completions = uniqBy(completions, (match) => match.room);
            return completions
                .map(
                    (room): ICompletion => ({
                        completion: room.displayedAlias,
                        completionId: room.room.roomId,
                        type: "room",
                        suffix: " ",
                        href: makeRoomPermalink(this.room.client, room.displayedAlias),
                        component: (
                            <PillCompletion title={room.room.name} description={room.displayedAlias}>
                                <RoomAvatar size="24px" room={room.room} />
                            </PillCompletion>
                        ),
                        range: range!,
                    }),
                )
                .filter((completion) => !!completion.completion && completion.completion.length > 0);
        }
        return [];
    }

    public getName(): string {
        return _t("common|rooms");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="presentation"
                aria-label={_t("composer|autocomplete|room_a11y")}
            >
                {completions}
            </div>
        );
    }
}
