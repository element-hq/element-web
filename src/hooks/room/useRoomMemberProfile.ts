/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RoomMember } from "matrix-js-sdk/src/matrix";
import { useContext, useMemo } from "react";

import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import { useSettingValue } from "../useSettings";

export function useRoomMemberProfile({
    userId = "",
    member: propMember,
    forceHistorical = false,
}: {
    userId: string | undefined;
    member?: RoomMember | null;
    forceHistorical?: boolean;
}): RoomMember | undefined | null {
    const context = useContext(RoomContext);
    const useOnlyCurrentProfiles = useSettingValue("useOnlyCurrentProfiles");

    const member = useMemo(() => {
        const threadContexts = [TimelineRenderingType.ThreadsList, TimelineRenderingType.Thread];
        if ((!forceHistorical && useOnlyCurrentProfiles) || threadContexts.includes(context.timelineRenderingType)) {
            const currentMember = context.room?.getMember(userId);
            if (currentMember) return currentMember;
        }

        return propMember;
    }, [forceHistorical, propMember, context.room, context.timelineRenderingType, useOnlyCurrentProfiles, userId]);

    return member;
}
