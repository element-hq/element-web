/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type RoomMember, type Room, KnownMembership } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useEffect, useMemo, useState, type FC } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import { CheckCircleIcon, InfoIcon, WarningIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";

import { formatDuration } from "../../../DateUtils";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];
const LONG_TERM_USER_MS = 28 * 24 * 60 * 60 * 1000; // ~a month ago.

enum InviteScore {
    Unknown = "unknown",
    Safe = "safe",
    Unsafe = "unsafe",
}

function SafetyDetailItem({
    title,
    description,
    score,
}: {
    title: string;
    description?: string;
    score?: InviteScore;
}): JSX.Element {
    score = score ?? InviteScore.Unknown;
    return (
        <li className={classNames("mx_RoomPreviewContext_detailsItem", score)}>
            {score === InviteScore.Unknown && <InfoIcon />}
            {score === InviteScore.Safe && <CheckCircleIcon />}
            {score === InviteScore.Unsafe && <WarningIcon />}
            <div>
                {title && <h1>{title}</h1>}
                {description && <p>{description}</p>}
            </div>
        </li>
    );
}

function useGetUserSafety(inviterMember: RoomMember | null): {
    score: InviteScore | null;
    details: {
        roomCount?: number;
        joinedTo?: { title: string; description: string; score: InviteScore };
        userFirstSeen?: { title: string; description: string; score: InviteScore };
        userBanned?: string;
        userKicked?: string;
    };
} {
    const client = useMatrixClientContext();
    const [joinedTo, setJoinedTo] = useState<{ title: string; description: string; score: InviteScore }>();
    const [roomCount, setRoomCount] = useState<number>();

    useEffect(() => {
        if (!inviterMember?.userId) {
            return;
        }

        (async () => {
            let rooms: string[];
            try {
                rooms = await client._unstable_getSharedRooms(inviterMember.userId);
            } catch (ex) {
                console.warn("getSharedRooms not supported, using slow path", ex);
                // Could not fetch rooms. We should fallback to the slow path.
                rooms = client
                    .getRooms()
                    .filter((r) => r.getJoinedMembers().some((m) => m.userId === inviterMember.userId))
                    .map((r) => r.roomId);
            }
            const joinedToPrivateSpaces = new Map<string, number>();
            const joinedToPrivateRooms = new Map<string, number>();
            const joinedToPublicSpaces = new Map<string, number>();
            const joinedToPublicRooms = new Map<string, number>();
            for (const roomId of rooms) {
                const room = client.getRoom(roomId);
                if (!room) {
                    continue;
                }
                if (room.isSpaceRoom()) {
                    if (PRIVATE_JOIN_RULES.includes(room.getJoinRule())) {
                        joinedToPrivateSpaces.set(room.name, room.getMembers().length);
                    } else {
                        joinedToPublicSpaces.set(room.name, room.getMembers().length);
                    }
                } else {
                    if (PRIVATE_JOIN_RULES.includes(room.getJoinRule())) {
                        joinedToPrivateRooms.set(room.name, room.getMembers().length);
                    } else {
                        joinedToPublicRooms.set(room.name, room.getMembers().length);
                    }
                }
            }

            for (const [roomSet, type] of [
                [joinedToPrivateSpaces, "private spaces"],
                [joinedToPrivateRooms, "private rooms"],
                [joinedToPublicSpaces, "spaces"],
                [joinedToPublicRooms, "public rooms"],
            ] as [Map<string, number>, string][]) {
                if (roomSet.size === 0) {
                    continue;
                }
                const roomNames = [...roomSet]
                    .sort(([, memberCountA], [, memberCountB]) => memberCountB - memberCountA)
                    .slice(0, 3)
                    .map(([name]) => name)
                    .join(", ");
                if (roomNames) {
                    setJoinedTo({
                        description: `You share ${roomSet.size} ${type}, including ${roomNames}`,
                        title: `You share ${type}`,
                        score: type === "private spaces" ? InviteScore.Safe : InviteScore.Unknown,
                    });
                } else {
                    setJoinedTo({
                        description: `You share ${roomSet.size} ${type}`,
                        title: `You share ${type}`,
                        score: type === "private spaces" ? InviteScore.Safe : InviteScore.Unknown,
                    });
                }
                break;
            }
            setRoomCount(rooms.filter((r) => r !== inviterMember.roomId).length);
        })();

        return () => {
            setRoomCount(undefined);
        };
    }, [client, inviterMember]);

    const userBanned = useMemo(() => {
        if (!inviterMember?.userId) {
            return;
        }
        const bannedRooms = client
            .getRooms()
            .map<[Room, RoomMember | null]>((r) => [r, r.getMember(inviterMember?.userId)])
            .filter(([room, member]) => member?.membership === KnownMembership.Ban);
        if (bannedRooms.length) {
            const exampleNames = bannedRooms
                .filter(([room]) => room.normalizedName && room.normalizedName !== room.roomId)
                .slice(0, 3)
                .map(([room]) => room.normalizedName)
                .join(", ");
            if (exampleNames) {
                return `User has been banned from ${bannedRooms.length} rooms, including ${exampleNames}`;
            }
            return `User has been banned from ${bannedRooms.length} rooms`;
        }
        return;
    }, [client, inviterMember]);

    const userKicked = useMemo(() => {
        if (!inviterMember?.userId) {
            return;
        }
        const kickedRooms = client
            .getRooms()
            .map<[Room, RoomMember | null]>((r) => [r, r.getMember(inviterMember?.userId)])
            .filter(([room, member]) => member?.isKicked());
        if (kickedRooms.length) {
            const exampleNames = kickedRooms
                .filter(([room]) => room.normalizedName && room.normalizedName !== room.roomId)
                .slice(0, 3)
                .map(([room]) => room.normalizedName)
                .join(", ");
            if (exampleNames) {
                return `User has been kicked from ${kickedRooms.length} rooms, including ${exampleNames}`;
            }
            return `User has been kicked from ${kickedRooms.length} rooms`;
        }
        return;
    }, [client, inviterMember]);

    const userFirstSeen = useMemo<{ title: string; score: InviteScore; description: string } | undefined>(() => {
        if (!inviterMember?.userId) {
            return;
        }
        const earliestMembershipTs = client
            .getRooms()
            .map((r) => r.getMember(inviterMember?.userId))
            .filter((member) => member?.membership === KnownMembership.Join)
            .map((member) => member?.events.member?.getTs())
            .filter((ts) => ts !== undefined)
            .sort((tsA, tsB) => tsA - tsB)[0];

        if (earliestMembershipTs) {
            const userDuration = Date.now() - earliestMembershipTs;
            if (userDuration > LONG_TERM_USER_MS) {
                const description = `You first saw activity from this user ${formatDuration(userDuration)} ago.`;
                return { title: `This user has been active for a while.`, description, score: InviteScore.Safe };
            } else {
                const description = `The earliest activity you have seen from this user was ${formatDuration(userDuration)} ago.`;
                return {
                    title: `This user may have recently created their account.`,
                    description,
                    score: InviteScore.Unknown,
                };
            }
        }
        return;
    }, [client, inviterMember]);

    const score = useMemo<InviteScore | null>(() => {
        if (!roomCount) {
            return null;
        }
        if (roomCount === 0 || userBanned || userKicked) {
            return InviteScore.Unsafe;
        }
        if (userFirstSeen?.score === InviteScore.Unknown || joinedTo?.score === InviteScore.Unknown) {
            return InviteScore.Unknown;
        }
        return InviteScore.Safe;
    }, [roomCount, userBanned, userKicked, joinedTo, userFirstSeen]);

    return {
        score,
        details: {
            roomCount,
            joinedTo,
            userBanned,
            userKicked,
            userFirstSeen,
        },
    };
}

export const RoomPreviewContext: FC<{ inviterMember: RoomMember | null }> = ({ inviterMember }) => {
    const { score, details } = useGetUserSafety(inviterMember);
    const [learnMoreOpen, setLearnMoreOpen] = useState<boolean>(false);

    if (!score) {
        return (
            <div className="mx_RoomPreviewContext_Badge">
                <InlineSpinner />
                <span>Checking invite safety</span>
            </div>
        );
    }

    const { roomCount, joinedTo, userBanned, userKicked, userFirstSeen } = details;
    return (
        <ul className="mx_RoomPreviewContext">
            {roomCount === 0 && <SafetyDetailItem title="You have no shared rooms" score={InviteScore.Unsafe} />}
            {userBanned && (
                <SafetyDetailItem
                    score={InviteScore.Unsafe}
                    title="User has been banned from rooms in the past"
                    description={learnMoreOpen ? userBanned : undefined}
                />
            )}
            {userKicked && (
                <SafetyDetailItem
                    score={InviteScore.Unsafe}
                    title="User has been kicked from rooms in the past"
                    description={learnMoreOpen ? userKicked : undefined}
                />
            )}
            {joinedTo && (
                <SafetyDetailItem {...joinedTo} description={learnMoreOpen ? joinedTo.description : undefined} />
            )}
            {userFirstSeen && (
                <SafetyDetailItem
                    {...userFirstSeen}
                    description={learnMoreOpen ? userFirstSeen.description : undefined}
                />
            )}
            {!learnMoreOpen && (
                <li>
                    <Button kind="tertiary" size="sm" onClick={() => setLearnMoreOpen(true)}>
                        Explain safety information
                    </Button>
                </li>
            )}
        </ul>
    );
};
