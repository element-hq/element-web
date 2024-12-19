/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef, Ref } from "react";

import AccessibleButton, { ButtonProps } from "../../components/views/elements/AccessibleButton";

type Props<T extends keyof HTMLElementTagNameMap> = ButtonProps<T> & {
    label?: string;
    // whether the context menu is currently open
    isExpanded: boolean;
};

// Semantic component for representing the AccessibleButton which launches a <ContextMenu />
export const ContextMenuButton = forwardRef(function <T extends keyof HTMLElementTagNameMap>(
    { label, isExpanded, children, onClick, onContextMenu, ...props }: Props<T>,
    ref: Ref<HTMLElementTagNameMap[T]>,
) {
    return (
        <AccessibleButton
            {...props}
            onClick={onClick}
            onContextMenu={onContextMenu ?? onClick ?? undefined}
            aria-label={label}
            aria-haspopup={true}
            aria-expanded={isExpanded}
            ref={ref}
        >
            {children}
        </AccessibleButton>
    );
});
