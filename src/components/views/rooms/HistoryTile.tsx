/*
Copyright 2021 Robin Townsend <robin@robin.town>

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

import React, { useContext } from "react";
import { EventTimeline } from "matrix-js-sdk/src/matrix";

import EventTileBubble from "../messages/EventTileBubble";
import RoomContext from "../../../contexts/RoomContext";
import { _t } from "../../../languageHandler";

const HistoryTile: React.FC = () => {
    const { room } = useContext(RoomContext);

    const oldState = room?.getLiveTimeline().getState(EventTimeline.BACKWARDS);
    const encryptionState = oldState?.getStateEvents("m.room.encryption")[0];
    const historyState = oldState?.getStateEvents("m.room.history_visibility")[0]?.getContent().history_visibility;

    let subtitle: string | undefined;
    if (historyState == "invited") {
        subtitle = _t("timeline|no_permission_messages_before_invite");
    } else if (historyState == "joined") {
        subtitle = _t("timeline|no_permission_messages_before_join");
    } else if (encryptionState) {
        subtitle = _t("timeline|encrypted_historical_messages_unavailable");
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
