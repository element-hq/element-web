/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { type Call } from "../../../models/Call";
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
                    aria-label={_t("voip|n_people_joined", { count: participantCount })}
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
        text={_t("common|video")}
        active={false}
        participantCount={useParticipantCount(call)}
    />
);
