/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";

export enum LiveContentType {
    Video,
    Voice,
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
                mx_LiveContentSummary_text_voice: type === LiveContentType.Voice,
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
