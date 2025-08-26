import { JoinRule, RoomMember, Room, KnownMembership } from "matrix-js-sdk/src/matrix";
import React, { useEffect, useMemo, useState, type FC } from "react";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { formatDuration } from "../../../DateUtils";
import { Alert } from "@vector-im/compound-web";

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];
const LONG_TERM_USER_MS = 28 * 24 * 60 * 60 * 1000; // ~a month ago.


export const RoomPreviewContext: FC<{inviterMember: RoomMember|null}> = ({inviterMember}) => {
    const client = useMatrixClientContext();
    const [joinedTo, setJoinedTo] = useState<{title: string, description: string, type: "info"|"success"}|null>();
    const [roomCount, setRoomCount] = useState<number|null>();

    useEffect(() => {
        if (!inviterMember?.userId) {
            return;
        }

        (async () => {
            let rooms;
            try {
                rooms = await client._unstable_getSharedRooms(inviterMember.userId);
            } catch (ex) {
                // Could not fetch rooms.
                // TODO: Handle error.
                return;
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

            for (const [roomSet, type] of ([[joinedToPrivateSpaces, "private spaces"], [joinedToPrivateRooms, "private rooms"], [joinedToPublicSpaces, "spaces"], [joinedToPublicRooms, "rooms"]] as [Map<string, number>, string][])) {
                if (roomSet.size === 0) {
                    continue;
                }
                const roomNames = [...roomSet].sort(([,memberCountA], [,memberCountB]) => memberCountB - memberCountA).slice(0,3).map(([name]) => name).join(', ');
                if (roomNames) {
                    setJoinedTo({description: `You share ${roomSet.size} ${type}, including ${roomNames}`, title: `You share ${type}`, type: type === "private spaces" ? "success" : "info"});
                } else {
                    setJoinedTo({description: `You share ${roomSet.size} ${type}`, title: `You share ${type}`, type: type === "private spaces" ? "success" : "info"});
                }
                break;
            }
            setRoomCount(rooms.filter(r => r !== inviterMember.roomId).length);
        })();

        return () => {
            setRoomCount(null);
        }
    },[client, inviterMember]);

    const userBanned = useMemo(() => {
        if (!inviterMember?.userId) {
            return null;
        }
        const bannedRooms = client.getRooms().map<[Room, RoomMember|null]>((r) => [r ,r.getMember(inviterMember?.userId)]).filter(([room, member]) => member?.membership === KnownMembership.Ban);
        if (bannedRooms.length) {
            const exampleNames = bannedRooms.filter(([room]) => room.normalizedName && room.normalizedName !== room.roomId).slice(0,3).map(([room]) => room.normalizedName).join(', ');
            if (exampleNames) {
                return `User has been banned from ${bannedRooms.length} rooms, including ${exampleNames}`;
            }
            return `User has been banned from ${bannedRooms.length} rooms`;
        }
        return null;
    }, [client, inviterMember]);

    const userKicked = useMemo(() => {
        if (!inviterMember?.userId) {
            return null;
        }
        const kickedRooms = client.getRooms().map<[Room, RoomMember|null]>((r) => [r ,r.getMember(inviterMember?.userId)]).filter(([room, member]) => member?.isKicked());
        if (kickedRooms.length) {
            const exampleNames = kickedRooms.filter(([room]) => room.normalizedName && room.normalizedName !== room.roomId).slice(0,3).map(([room]) => room.normalizedName).join(', ');
            if (exampleNames) {
                return `User has been kicked from ${kickedRooms.length} rooms, including ${exampleNames}`;
            }
            return `User has been kicked from ${kickedRooms.length} rooms`;
        }
        return null;
    }, [client, inviterMember]);

    const userFirstSeen = useMemo<null|{text: string, type: "success" | "info" | "critical", description: string}>(() => {
        if (!inviterMember?.userId) {
            return null;
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
                return { text: `This user has been active for a while.`, description, type: "success" }
            } else {
                const description = `The earliest activity you have seen from this user was ${formatDuration(userDuration)} ago.`;
                return { text: `This user may have recently created their account.`, description, type: "critical" };
            }
            
        }
        return null;
    }, [client, inviterMember]);


    if (!inviterMember) {
        return null;
    }

    return <ul className="mx_RoomPreviewContext">
        {roomCount === 0 && <li>
            <Alert type="critical" title={"You have no shared rooms"}></Alert>
        </li>}
        {joinedTo && <li>
            <Alert type={joinedTo.type} title={joinedTo.title}>{joinedTo.description}</Alert>
        </li>}
        {userBanned && <li>
            <Alert type="critical" title={"User has been banned from rooms in the past"}>{userBanned}</Alert>
        </li>}
        {userKicked && <li>
            <Alert type="critical" title={"User has been kicked from rooms in the past"}>{userKicked}</Alert>
        </li>}
        {userFirstSeen && <li>
            <Alert type={userFirstSeen.type} title={userFirstSeen.text}>{userFirstSeen.description}</Alert>
        </li>}
        {roomCount !== 0 && <li>
            <Alert type="info" title={`You share ${roomCount} rooms.`}></Alert>
        </li>}
    </ul>;
}