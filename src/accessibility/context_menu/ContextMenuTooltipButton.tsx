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

import React, { ComponentProps, forwardRef, Ref } from "react";

import AccessibleButton from "../../components/views/elements/AccessibleButton";

type Props<T extends keyof JSX.IntrinsicElements> = ComponentProps<typeof AccessibleButton<T>> & {
    // whether the context menu is currently open
    isExpanded: boolean;
};

// Semantic component for representing the AccessibleButton which launches a <ContextMenu />
export const ContextMenuTooltipButton = forwardRef(function <T extends keyof JSX.IntrinsicElements>(
    { isExpanded, children, onClick, onContextMenu, element, ...props }: Props<T>,
    ref: Ref<HTMLElement>,
) {
    return (
        <AccessibleButton
            {...props}
            element={element as keyof JSX.IntrinsicElements}
            onClick={onClick}
            onContextMenu={onContextMenu ?? onClick ?? undefined}
            aria-haspopup={true}
            aria-expanded={isExpanded}
            disableTooltip={isExpanded}
            ref={ref}
        >
            {children}
        </AccessibleButton>
    );
});
