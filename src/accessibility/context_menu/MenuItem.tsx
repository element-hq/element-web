/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { RovingAccessibleButton } from "../RovingTabIndex";

type IProps<T extends keyof JSX.IntrinsicElements> = React.ComponentProps<typeof RovingAccessibleButton<T>> & {
    label?: string;
};

// Semantic component for representing a role=menuitem
export const MenuItem = <T extends keyof JSX.IntrinsicElements>({
    children,
    label,
    ...props
}: IProps<T>): JSX.Element => {
    const ariaLabel = props["aria-label"] || label;

    return (
        <RovingAccessibleButton {...props} role="menuitem" aria-label={ariaLabel}>
            {children}
        </RovingAccessibleButton>
    );
};
