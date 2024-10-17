/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React from "react";

import { Icon as LiveIcon } from "../../../../res/img/compound/live-16px.svg";
import { _t } from "../../../languageHandler";

interface Props {
    grey?: boolean;
}

export const LiveBadge: React.FC<Props> = ({ grey = false }) => {
    const liveBadgeClasses = classNames("mx_LiveBadge", {
        "mx_LiveBadge--grey": grey,
    });

    return (
        <div className={liveBadgeClasses}>
            <LiveIcon className="mx_Icon mx_Icon_16" />
            {_t("voice_broadcast|live")}
        </div>
    );
};
