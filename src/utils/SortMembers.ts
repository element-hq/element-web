/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { groupBy, mapValues, maxBy, minBy, sumBy, takeRight } from "lodash";
import { type MatrixClient, type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { type Member } from "./direct-messages";
import DMRoomMap from "./DMRoomMap";

export const compareMembers =
    (
        activityScores: Record<string, IActivityScore | undefined>,
        memberScores: Record<string, IMemberScore | undefined>,
    ) =>
    (a: Member | RoomMember, b: Member | RoomMember): number => {
        const aActivityScore = activityScores[a.userId]?.score ?? 0;
        const aMemberScore = memberScores[a.userId]?.score ?? 0;
        const aScore = aActivityScore + aMemberScore;
        const aNumRooms = memberScores[a.userId]?.numRooms ?? 0;

        const bActivityScore = activityScores[b.userId]?.score ?? 0;
        const bMemberScore = memberScores[b.userId]?.score ?? 0;
        const bScore = bActivityScore + bMemberScore;
        const bNumRooms = memberScores[b.userId]?.numRooms ?? 0;

        if (aScore === bScore) {
            if (aNumRooms === bNumRooms) {
                // If there is no activity between members,
                // keep the order received from the user directory search results
                return 0;
            }

            return bNumRooms - aNumRooms;
        }
        return bScore - aScore;
    };

function joinedRooms(cli: MatrixClient): Room[] {
    return (
        cli
            .getRooms()
            .filter((r) => r.getMyMembership() === KnownMembership.Join)
            // Skip low priority rooms and DMs
            .filter((r) => !DMRoomMap.shared().getUserIdForRoomId(r.roomId))
            .filter((r) => !Object.keys(r.tags).includes("m.lowpriority"))
    );
}

interface IActivityScore {
    lastSpoke: number;
    score: number;
}

// Score people based on who have sent messages recently, as a way to improve the quality of suggestions.
// We do this by checking every room to see who has sent a message in the last few hours, and giving them
// a score which correlates to the freshness of their message. In theory, this results in suggestions
// which are closer to "continue this conversation" rather than "this person exists".
export function buildActivityScores(cli: MatrixClient): { [userId: string]: IActivityScore } {
    const now = new Date().getTime();
    const earliestAgeConsidered = now - 60 * 60 * 1000; // 1 hour ago
    const maxMessagesConsidered = 50; // so we don't iterate over a huge amount of traffic
    const events = joinedRooms(cli)
        .flatMap((room) => takeRight(room.getLiveTimeline().getEvents(), maxMessagesConsidered))
        .filter((ev) => ev.getTs() > earliestAgeConsidered);
    const senderEvents = groupBy(events, (ev) => ev.getSender());
    // If the iteratee in mapValues returns undefined that key will be removed from the resultant object
    return mapValues(senderEvents, (events) => {
        if (!events.length) return;
        const lastEvent = maxBy(events, (ev) => ev.getTs())!;
        const distanceFromNow = Math.abs(now - lastEvent.getTs()); // abs to account for slight future messages
        const inverseTime = now - earliestAgeConsidered - distanceFromNow;
        return {
            lastSpoke: lastEvent.getTs(),
            // Scores from being in a room give a 'good' score of about 1.0-1.5, so for our
            // score we'll try and award at least 1.0 for making the list, with 4.0 being
            // an approximate maximum for being selected.
            score: Math.max(1, inverseTime / (15 * 60 * 1000)), // 15min segments to keep scores sane
        };
    }) as { [key: string]: IActivityScore };
}

interface IMemberScore {
    member: RoomMember;
    score: number;
    numRooms: number;
}

export function buildMemberScores(cli: MatrixClient): { [userId: string]: IMemberScore } {
    const maxConsideredMembers = 200;
    const consideredRooms = joinedRooms(cli).filter((room) => room.getJoinedMemberCount() < maxConsideredMembers);
    const memberPeerEntries = consideredRooms.flatMap((room) =>
        room.getJoinedMembers().map((member) => ({ member, roomSize: room.getJoinedMemberCount() })),
    );
    const userMeta = groupBy(memberPeerEntries, ({ member }) => member.userId);
    // If the iteratee in mapValues returns undefined that key will be removed from the resultant object
    return mapValues(userMeta, (roomMemberships) => {
        if (!roomMemberships.length) return;
        const maximumPeers = maxConsideredMembers * roomMemberships.length;
        const totalPeers = sumBy(roomMemberships, (entry) => entry.roomSize);
        return {
            member: minBy(roomMemberships, (entry) => entry.roomSize)!.member,
            numRooms: roomMemberships.length,
            score: Math.max(0, Math.pow(1 - totalPeers / maximumPeers, 5)),
        };
    }) as { [userId: string]: IMemberScore };
}
