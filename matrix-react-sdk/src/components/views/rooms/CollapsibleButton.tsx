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

import React, { ComponentProps, useContext } from "react";
import classNames from "classnames";

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { MenuItem } from "../../structures/ContextMenu";
import { OverflowMenuContext } from "./MessageComposerButtons";
import { IconizedContextMenuOption } from "../context_menus/IconizedContextMenu";

interface ICollapsibleButtonProps extends ComponentProps<typeof MenuItem> {
    title: string;
    iconClassName: string;
}

export const CollapsibleButton: React.FC<ICollapsibleButtonProps> = ({
    title,
    children,
    className,
    iconClassName,
    ...props
}) => {
    const inOverflowMenu = !!useContext(OverflowMenuContext);
    if (inOverflowMenu) {
        return <IconizedContextMenuOption {...props} iconClassName={iconClassName} label={title} />;
    }

    return (
        <AccessibleTooltipButton {...props} title={title} className={classNames(className, iconClassName)}>
            {children}
        </AccessibleTooltipButton>
    );
};
