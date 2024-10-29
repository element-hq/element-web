/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { ReactElement } from "react";

import AccessibleButton from "../../../components/views/elements/AccessibleButton";

interface Props {
    className?: string;
    icon: ReactElement;
    label: string;
    onClick: () => void;
}

export const VoiceBroadcastControl: React.FC<Props> = ({ className = "", icon, label, onClick }) => {
    return (
        <AccessibleButton
            className={classNames("mx_VoiceBroadcastControl", className)}
            onClick={onClick}
            aria-label={label}
        >
            {icon}
        </AccessibleButton>
    );
};
