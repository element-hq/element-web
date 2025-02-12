/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";

import { Icon as PollIcon } from "../../../../../res/img/element-icons/room/composer/poll.svg";
import { formatLocalDateShort } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";

interface Props {
    event: MatrixEvent;
    onClick: () => void;
}

export const PollListItem: React.FC<Props> = ({ event, onClick }) => {
    const pollEvent = event.unstableExtensibleEvent as unknown as PollStartEvent;
    if (!pollEvent) {
        return null;
    }
    const formattedDate = formatLocalDateShort(event.getTs());
    return (
        <li data-testid={`pollListItem-${event.getId()!}`} className="mx_PollListItem" onClick={onClick}>
            <Tooltip label={_t("right_panel|poll|view_poll")} placement="top" isTriggerInteractive={false}>
                <div className="mx_PollListItem_content">
                    <span>{formattedDate}</span>
                    <PollIcon className="mx_PollListItem_icon" />
                    <span className="mx_PollListItem_question">{pollEvent.question.text}</span>
                </div>
            </Tooltip>
        </li>
    );
};
