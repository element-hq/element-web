/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { PollHistory } from "../../../polls/pollHistory/PollHistory";
import { RoomPermalinkCreator } from "../../../../../utils/permalinks/Permalinks";

interface IProps {
    room: Room;
    onFinished: () => void;
}

export const PollHistoryTab: React.FC<IProps> = ({ room, onFinished }) => {
    const matrixClient = useContext(MatrixClientContext);
    const permalinkCreator = new RoomPermalinkCreator(room, room.roomId);

    return (
        <div className="mx_SettingsTab">
            <PollHistory
                room={room}
                permalinkCreator={permalinkCreator}
                matrixClient={matrixClient}
                onFinished={onFinished}
            />
        </div>
    );
};
