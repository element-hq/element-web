/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

interface IProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
}

// Semantic component for representing a role=group for grouping menu radios/checkboxes
export const MenuGroup: React.FC<IProps> = ({ children, label, ...props }) => {
    return (
        <div {...props} role="group" aria-label={label}>
            {children}
        </div>
    );
};
