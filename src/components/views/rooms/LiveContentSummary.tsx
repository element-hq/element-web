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

import React, { FC } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { Call } from "../../../models/Call";
import { useParticipantCount } from "../../../hooks/useCall";

export enum LiveContentType {
    Video,
    // More coming soon
}

interface Props {
    type: LiveContentType;
    text: string;
    active: boolean;
    participantCount: number;
}

/**
 * Summary line used to call out live, interactive content such as calls.
 */
export const LiveContentSummary: FC<Props> = ({ type, text, active, participantCount }) => (
    <span className="mx_LiveContentSummary">
        <span
            className={classNames("mx_LiveContentSummary_text", {
                mx_LiveContentSummary_text_video: type === LiveContentType.Video,
                mx_LiveContentSummary_text_active: active,
            })}
        >
            {text}
        </span>
        {participantCount > 0 && (
            <>
                {" • "}
                <span
                    className="mx_LiveContentSummary_participants"
                    aria-label={_t("%(count)s participants", { count: participantCount })}
                >
                    {participantCount}
                </span>
            </>
        )}
    </span>
);

interface LiveContentSummaryWithCallProps {
    call: Call;
}

export const LiveContentSummaryWithCall: FC<LiveContentSummaryWithCallProps> = ({ call }) => (
    <LiveContentSummary
        type={LiveContentType.Video}
        text={_t("Video")}
        active={false}
        participantCount={useParticipantCount(call)}
    />
);
