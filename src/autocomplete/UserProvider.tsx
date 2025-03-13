/*
Copyright 2024 New Vector Ltd.
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017, 2018 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sortBy } from "lodash";
import {
    type MatrixEvent,
    type Room,
    RoomEvent,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
    type IRoomTimelineData,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../MatrixClientPeg";
import QueryMatcher from "./QueryMatcher";
import { PillCompletion } from "./Components";
import AutocompleteProvider from "./AutocompleteProvider";
import { _t } from "../languageHandler";
import { makeUserPermalink } from "../utils/permalinks/Permalinks";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import MemberAvatar from "../components/views/avatars/MemberAvatar";
import { type TimelineRenderingType } from "../contexts/RoomContext";
import UserIdentifierCustomisations from "../customisations/UserIdentifier";

const USER_REGEX = /\B@\S*/g;

// used when you hit 'tab' - we allow some separator chars at the beginning
// to allow you to tab-complete /mat into /(matthew)
const FORCED_USER_REGEX = /[^/,.():; \t\n]\S*/g;

export default class UserProvider extends AutocompleteProvider {
    public matcher: QueryMatcher<RoomMember>;
    public users?: RoomMember[];
    public room: Room;

    public constructor(room: Room, renderingType?: TimelineRenderingType) {
        super({
            commandRegex: USER_REGEX,
            forcedCommandRegex: FORCED_USER_REGEX,
            renderingType,
        });
        this.room = room;
        this.matcher = new QueryMatcher<RoomMember>([], {
            keys: ["name"],
            funcs: [(obj) => obj.userId.slice(1)], // index by user id minus the leading '@'
            shouldMatchWordsOnly: false,
        });

        MatrixClientPeg.safeGet().on(RoomEvent.Timeline, this.onRoomTimeline);
        MatrixClientPeg.safeGet().on(RoomStateEvent.Update, this.onRoomStateUpdate);
    }

    public destroy(): void {
        MatrixClientPeg.get()?.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Update, this.onRoomStateUpdate);
    }

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (!room) return; // notification timeline, we'll get this event again with a room specific timeline
        if (removed) return;
        if (room.roomId !== this.room.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // TODO: lazyload if we have no ev.sender room member?
        this.onUserSpoke(ev.sender);
    };

    private onRoomStateUpdate = (state: RoomState): void => {
        // ignore updates in other rooms
        if (state.roomId !== this.room.roomId) return;

        // blow away the users cache
        this.users = undefined;
    };

    public async getCompletions(
        rawQuery: string,
        selection: ISelectionRange,
        force = false,
        limit = -1,
    ): Promise<ICompletion[]> {
        // lazy-load user list into matcher
        if (!this.users) this.makeUsers();

        const { command, range } = this.getCurrentCommand(rawQuery, selection, force);

        const fullMatch = command?.[0];
        // Don't search if the query is a single "@"
        if (fullMatch && fullMatch !== "@") {
            // Don't include the '@' in our search query - it's only used as a way to trigger completion
            const query = fullMatch.startsWith("@") ? fullMatch.substring(1) : fullMatch;
            return this.matcher.match(query, limit).map((user) => {
                const description = UserIdentifierCustomisations.getDisplayUserIdentifier?.(user.userId, {
                    roomId: this.room.roomId,
                    withDisplayName: true,
                });
                const displayName = user.name || user.userId || "";
                return {
                    // Length of completion should equal length of text in decorator. draft-js
                    // relies on the length of the entity === length of the text in the decoration.
                    completion: user.rawDisplayName,
                    completionId: user.userId,
                    type: "user",
                    suffix: selection.beginning && range!.start === 0 ? ": " : " ",
                    href: makeUserPermalink(user.userId),
                    component: (
                        <PillCompletion title={displayName} description={description}>
                            <MemberAvatar member={user} size="24px" />
                        </PillCompletion>
                    ),
                    range: range!,
                };
            });
        }
        return [];
    }

    public getName(): string {
        return _t("composer|autocomplete|user_description");
    }

    private makeUsers(): void {
        const events = this.room.getLiveTimeline().getEvents();
        const lastSpoken: Record<string, number> = {};

        for (const event of events) {
            lastSpoken[event.getSender()!] = event.getTs();
        }

        const currentUserId = MatrixClientPeg.safeGet().credentials.userId;
        this.users = this.room.getJoinedMembers().filter(({ userId }) => userId !== currentUserId);
        this.users = this.users.concat(this.room.getMembersWithMembership(KnownMembership.Invite));

        this.users = sortBy(this.users, (member) => 1e20 - lastSpoken[member.userId] || 1e20);

        this.matcher.setObjects(this.users);
    }

    public onUserSpoke(user: RoomMember | null): void {
        if (!this.users) return;
        if (!user) return;
        if (user.userId === MatrixClientPeg.safeGet().getSafeUserId()) return;

        // Move the user that spoke to the front of the array
        this.users.splice(
            this.users.findIndex((user2) => user2.userId === user.userId),
            1,
        );
        this.users = [user, ...this.users];

        this.matcher.setObjects(this.users);
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill"
                role="presentation"
                aria-label={_t("composer|autocomplete|user_a11y")}
            >
                {completions}
            </div>
        );
    }

    public shouldForceComplete(): boolean {
        return true;
    }
}
