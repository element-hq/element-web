/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { useMemo } from "react";

import { TimelineRenderingType } from "../../contexts/RoomContext";
import { useSettingValue } from "../useSettings";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext.tsx";
import { type MemberInfo } from "../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";

/** Inputs for resolving the room member that should be rendered. */
export interface RoomMemberProfileResolutionProps {
    /** Room used to look up the current member, if needed. */
    room?: Pick<Room, "getMember"> | null;
    /** Matrix user ID to resolve. */
    userId?: string;
    /** Historical member snapshot from the event, if available. */
    member?: RoomMember | null;
    /** Whether historical profiles should always be preserved. */
    forceHistorical?: boolean;
    /** Whether the current profile should be preferred. */
    useOnlyCurrentProfiles?: boolean;
    /** Timeline context used to force current profiles for thread surfaces. */
    timelineRenderingType?: TimelineRenderingType;
}

/**
 * Resolves the room member that should drive profile rendering.
 */
export function resolveRoomMemberProfile({
    room,
    userId,
    member: propMember,
    forceHistorical = false,
    useOnlyCurrentProfiles = false,
    timelineRenderingType = TimelineRenderingType.Room,
}: RoomMemberProfileResolutionProps): RoomMember | undefined | null {
    const threadContexts = [TimelineRenderingType.ThreadsList, TimelineRenderingType.Thread];
    if ((!forceHistorical && useOnlyCurrentProfiles) || threadContexts.includes(timelineRenderingType)) {
        const currentMember = room?.getMember(userId ?? "");
        if (currentMember) return currentMember;
    }

    return propMember;
}

/**
 * Converts a room member into the plain render data used by shared profile components.
 */
export function roomMemberToMemberInfo(member: RoomMember | undefined | null): MemberInfo | null {
    if (!member) {
        return null;
    }

    return {
        userId: member.userId,
        roomId: member.roomId,
        rawDisplayName: member.rawDisplayName,
        disambiguate: member.disambiguate,
    };
}

export function useRoomMemberProfile({
    userId = "",
    member: propMember,
    forceHistorical = false,
}: {
    userId: string | undefined;
    member?: RoomMember | null;
    forceHistorical?: boolean;
}): RoomMember | undefined | null {
    const context = useScopedRoomContext("room", "timelineRenderingType");
    const useOnlyCurrentProfiles = useSettingValue("useOnlyCurrentProfiles");

    const member = useMemo(() => {
        return resolveRoomMemberProfile({
            room: context.room,
            userId,
            member: propMember,
            forceHistorical,
            useOnlyCurrentProfiles,
            timelineRenderingType: context.timelineRenderingType,
        });
    }, [forceHistorical, propMember, context.room, context.timelineRenderingType, useOnlyCurrentProfiles, userId]);

    return member;
}
