/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useEffect, useState } from "react";
import {
    ClientEvent,
    type Room,
    type RoomMember,
    RoomStateEvent,
    type User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";

import { isPresenceEnabled } from "../../../utils/presence";
import DMRoomMap from "../../../utils/DMRoomMap";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { BUSY_PRESENCE_NAME } from "../rooms/PresenceLabel";
import AvatarPresenceIconView from "../rooms/MemberList/tiles/common/PresenceIconView";

interface Props {
    room: Room;
    children: ReactNode;
}

export enum Presence {
    // This class used to have its own presence indicator and has been
    // updated to use the new one so presence colours / icons match across the app.
    // These values are the ones from the wire that PresenceIconView expects,
    // but really some of the logic here could be deduplicated.
    Online = "online",
    Away = "unavailable",
    Offline = "offline",
    Busy = "busy",
}

function getDmMember(room: Room): RoomMember | null {
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    return otherUserId ? room.getMember(otherUserId) : null;
}

export const useDmMember = (room?: Room): RoomMember | null => {
    const [dmMember, setDmMember] = useState<RoomMember | null>(room ? getDmMember(room) : null);
    const updateDmMember = (): void => {
        setDmMember(room ? getDmMember(room) : null);
    };

    useEventEmitter(room?.currentState, RoomStateEvent.Members, updateDmMember);
    useEventEmitter(room?.client, ClientEvent.AccountData, updateDmMember);
    useEffect(updateDmMember, [room]);

    return dmMember;
};

function getPresenceFromUser(user: User | null | undefined): Presence | null {
    if (!user) return null;

    const presence = user.presence;
    const isOnline = user.currentlyActive || presence === "online";
    if (BUSY_PRESENCE_NAME.matches(presence)) {
        return Presence.Busy;
    }
    if (isOnline) {
        return Presence.Online;
    }
    if (presence === "offline") {
        return Presence.Offline;
    }
    if (presence === "unavailable") {
        return Presence.Away;
    }

    return null;
}

function getPresence(room: Room, member: RoomMember | null): Presence | null {
    // Fall back to client.getUser() when member.user is not yet linked during initial sync
    const user = member?.user ?? (member ? room.client.getUser(member.userId) : null);
    return getPresenceFromUser(user);
}

export const usePresence = (room: Room, member: RoomMember | null): Presence | null => {
    const [presence, setPresence] = useState<Presence | null>(getPresence(room, member));
    const updatePresence = (): void => {
        setPresence(getPresence(room, member));
    };

    useEventEmitter(member?.user, UserEvent.Presence, updatePresence);
    useEventEmitter(member?.user, UserEvent.CurrentlyActive, updatePresence);
    // Also listen at client level to catch presence events when member.user is not yet linked
    useEventEmitter(room.client, UserEvent.Presence, (_event: unknown, user: User) => {
        if (user?.userId === member?.userId) updatePresence();
    });
    useEffect(updatePresence, [room, member]);

    if (getJoinedNonFunctionalMembers(room).length !== 2 || !isPresenceEnabled(room.client)) return null;
    return presence;
};

const WithPresenceIndicator: React.FC<Props> = ({ room, children }) => {
    const dmMember = useDmMember(room);
    const presence = usePresence(room, dmMember);

    let icon: JSX.Element | undefined;
    if (presence) {
        icon = <AvatarPresenceIconView presenceState={presence} />;
    }

    if (!presence) return <>{children}</>;

    return (
        <div className="mx_WithPresenceIndicator">
            {children}
            <div className="mx_WithPresenceIndicator_icon">{icon}</div>
        </div>
    );
};

export default WithPresenceIndicator;
