/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { RoomMember } from "matrix-js-sdk/src/models/room-member";
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
