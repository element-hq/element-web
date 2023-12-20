/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps } from "react";

import AccessibleTooltipButton from "../../components/views/elements/AccessibleTooltipButton";

type Props<T extends keyof JSX.IntrinsicElements> = ComponentProps<typeof AccessibleTooltipButton<T>> & {
    // whether the context menu is currently open
    isExpanded: boolean;
};

// Semantic component for representing the AccessibleButton which launches a <ContextMenu />
export const ContextMenuTooltipButton = <T extends keyof JSX.IntrinsicElements>({
    isExpanded,
    children,
    onClick,
    onContextMenu,
    ...props
}: Props<T>): JSX.Element => {
    return (
        <AccessibleTooltipButton
            {...props}
            onClick={onClick}
            onContextMenu={onContextMenu ?? onClick ?? undefined}
            aria-haspopup={true}
            aria-expanded={isExpanded}
            forceHide={isExpanded}
        >
            {children}
        </AccessibleTooltipButton>
    );
};
