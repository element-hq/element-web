/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AccessibleButton from "../../../components/views/elements/AccessibleButton";

interface Props {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    label: string;
    onClick: () => void;
}

export const SeekButton: React.FC<Props> = ({ onClick, icon: Icon, label }) => {
    return (
        <AccessibleButton kind="secondary_content" onClick={onClick} aria-label={label}>
            <Icon className="mx_Icon mx_Icon_24" />
        </AccessibleButton>
    );
};
