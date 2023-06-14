/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/matrix";

import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { PollHistory } from "../polls/pollHistory/PollHistory";
import BaseDialog from "./BaseDialog";

type PollHistoryDialogProps = {
    room: Room;
    matrixClient: MatrixClient;
    permalinkCreator: RoomPermalinkCreator;
    onFinished(): void;
};

export const PollHistoryDialog: React.FC<PollHistoryDialogProps> = ({
    room,
    matrixClient,
    permalinkCreator,
    onFinished,
}) => {
    // @TODO hide dialog title somehow
    return (
        <BaseDialog onFinished={onFinished}>
            <PollHistory
                room={room}
                matrixClient={matrixClient}
                permalinkCreator={permalinkCreator}
                onFinished={onFinished}
            />
        </BaseDialog>
    );
};
