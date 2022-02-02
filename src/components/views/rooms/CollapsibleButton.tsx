/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps, useContext } from 'react';
import classNames from 'classnames';

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { MenuItem } from "../../structures/ContextMenu";
import { OverflowMenuContext } from './MessageComposerButtons';

interface ICollapsibleButtonProps extends ComponentProps<typeof MenuItem> {
    title: string;
}

export const CollapsibleButton = ({ title, children, className, ...props }: ICollapsibleButtonProps) => {
    const inOverflowMenu = !!useContext(OverflowMenuContext);
    if (inOverflowMenu) {
        return <MenuItem
            {...props}
            className={classNames("mx_CallContextMenu_item", className)}
        >
            { title }
            { children }
        </MenuItem>;
    }

    return <AccessibleTooltipButton
        {...props}
        title={title}
        className={className}
    >
        { children }
    </AccessibleTooltipButton>;
};

export default CollapsibleButton;
