/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Robin Townsend <robin@robin.town>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { EventTimeline } from "matrix-js-sdk/src/matrix";

import EventTileBubble from "../messages/EventTileBubble";
import RoomContext from "../../../contexts/RoomContext";
import { _t } from "../../../languageHandler";

const HistoryTile: React.FC = () => {
    const { room } = useContext(RoomContext);

    const oldState = room?.getLiveTimeline().getState(EventTimeline.BACKWARDS);
    const historyState = oldState?.getStateEvents("m.room.history_visibility")[0]?.getContent().history_visibility;

    let subtitle: string | undefined;
    if (historyState == "invited") {
        subtitle = _t("timeline|no_permission_messages_before_invite");
    } else if (historyState == "joined") {
        subtitle = _t("timeline|no_permission_messages_before_join");
    }

    return (
        <EventTileBubble
            className="mx_HistoryTile"
            title={_t("timeline|historical_messages_unavailable")}
            subtitle={subtitle}
        />
    );
};

export default HistoryTile;
