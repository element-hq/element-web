/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { PollsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { formatLocalDateShort } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton.tsx";

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
        <li data-testid={`pollListItem-${event.getId()!}`} className="mx_PollListItem">
            <AccessibleButton
                className="mx_PollListItemEnded_content"
                title={_t("right_panel|poll|view_poll")}
                placement="top"
                onClick={onClick}
            >
                <div className="mx_PollListItem_content">
                    <span>{formattedDate}</span>
                    <PollsIcon className="mx_PollListItem_icon" />
                    <span className="mx_PollListItem_question">{pollEvent.question.text}</span>
                </div>
            </AccessibleButton>
        </li>
    );
};
