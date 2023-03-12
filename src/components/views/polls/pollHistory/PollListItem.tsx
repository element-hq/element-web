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
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { Icon as PollIcon } from "../../../../../res/img/element-icons/room/composer/poll.svg";
import { formatLocalDateShort } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";
import TooltipTarget from "../../elements/TooltipTarget";
import { Alignment } from "../../elements/Tooltip";

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
            <TooltipTarget label={_t("View poll")} alignment={Alignment.Top}>
                <div className="mx_PollListItem_content">
                    <span>{formattedDate}</span>
                    <PollIcon className="mx_PollListItem_icon" />
                    <span className="mx_PollListItem_question">{pollEvent.question.text}</span>
                </div>
            </TooltipTarget>
        </li>
    );
};
