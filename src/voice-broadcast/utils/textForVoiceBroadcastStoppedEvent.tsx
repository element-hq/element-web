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

import React, { ReactNode } from "react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import AccessibleButton from "../../components/views/elements/AccessibleButton";
import { highlightEvent } from "../../utils/EventUtils";
import { _t } from "../../languageHandler";
import { getSenderName } from "../../utils/event/getSenderName";

export const textForVoiceBroadcastStoppedEvent = (event: MatrixEvent, client: MatrixClient): (() => ReactNode) => {
    return (): ReactNode => {
        const ownUserId = MatrixClientPeg.get()?.getUserId();
        const startEventId = event.getRelation()?.event_id;
        const roomId = event.getRoomId();

        const templateTags = {
            a: (text: string) =>
                startEventId && roomId ? (
                    <AccessibleButton kind="link_inline" onClick={(): void => highlightEvent(roomId, startEventId)}>
                        {text}
                    </AccessibleButton>
                ) : (
                    text
                ),
        };

        if (ownUserId && ownUserId === event.getSender()) {
            return _t("You ended a <a>voice broadcast</a>", {}, templateTags);
        }

        return _t("%(senderName)s ended a <a>voice broadcast</a>", { senderName: getSenderName(event) }, templateTags);
    };
};
