/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode, useEffect, useState } from "react";
import { ClientEvent, Room, RoomMember, RoomStateEvent, UserEvent } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";

import { isPresenceEnabled } from "../../../utils/presence";
import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { BUSY_PRESENCE_NAME } from "../rooms/PresenceLabel";

interface Props {
    room: Room;
    size: string; // CSS size
    tooltipProps?: {
        tabIndex?: number;
    };
    children: ReactNode;
}

enum Presence {
    // Note: the names here are used in CSS class names
    Online = "ONLINE",
    Away = "AWAY",
    Offline = "OFFLINE",
    Busy = "BUSY",
}

function tooltipText(variant: Presence): string {
    switch (variant) {
        case Presence.Online:
            return _t("presence|online");
        case Presence.Away:
            return _t("presence|away");
        case Presence.Offline:
            return _t("presence|offline");
        case Presence.Busy:
            return _t("presence|busy");
    }
}

function getDmMember(room: Room): RoomMember | null {
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    return otherUserId ? room.getMember(otherUserId) : null;
}

export const useDmMember = (room: Room): RoomMember | null => {
    const [dmMember, setDmMember] = useState<RoomMember | null>(getDmMember(room));
    const updateDmMember = (): void => {
        setDmMember(getDmMember(room));
    };

    useEventEmitter(room.currentState, RoomStateEvent.Members, updateDmMember);
    useEventEmitter(room.client, ClientEvent.AccountData, updateDmMember);
    useEffect(updateDmMember, [room]);

    return dmMember;
};

function getPresence(member: RoomMember | null): Presence | null {
    if (!member?.user) return null;

    const presence = member.user.presence;
    const isOnline = member.user.currentlyActive || presence === "online";
    if (BUSY_PRESENCE_NAME.matches(member.user.presence)) {
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

const usePresence = (room: Room, member: RoomMember | null): Presence | null => {
    const [presence, setPresence] = useState<Presence | null>(getPresence(member));
    const updatePresence = (): void => {
        setPresence(getPresence(member));
    };

    useEventEmitter(member?.user, UserEvent.Presence, updatePresence);
    useEventEmitter(member?.user, UserEvent.CurrentlyActive, updatePresence);
    useEffect(updatePresence, [member]);

    if (getJoinedNonFunctionalMembers(room).length !== 2 || !isPresenceEnabled(room.client)) return null;
    return presence;
};

const WithPresenceIndicator: React.FC<Props> = ({ room, size, tooltipProps, children }) => {
    const dmMember = useDmMember(room);
    const presence = usePresence(room, dmMember);

    let icon: JSX.Element | undefined;
    if (presence) {
        icon = (
            <div
                tabIndex={tooltipProps?.tabIndex ?? 0}
                className={`mx_WithPresenceIndicator_icon mx_WithPresenceIndicator_icon_${presence.toLowerCase()}`}
                style={{
                    width: size,
                    height: size,
                }}
            />
        );
    }

    if (!presence) return <>{children}</>;

    return (
        <div className="mx_WithPresenceIndicator">
            {children}
            <Tooltip label={tooltipText(presence)} placement="bottom">
                {icon}
            </Tooltip>
        </div>
    );
};

export default WithPresenceIndicator;
