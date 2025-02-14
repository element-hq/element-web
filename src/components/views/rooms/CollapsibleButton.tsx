/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import classNames from "classnames";

import AccessibleButton, { type ButtonProps } from "../elements/AccessibleButton";
import { OverflowMenuContext } from "./MessageComposerButtons";
import { IconizedContextMenuOption } from "../context_menus/IconizedContextMenu";
import { type Ref } from "../../../accessibility/roving/types";

interface Props extends Omit<ButtonProps<"div">, "element"> {
    inputRef?: Ref;
    title: string;
    iconClassName: string;
}

export const CollapsibleButton: React.FC<Props> = ({
    title,
    children,
    className,
    iconClassName,
    inputRef,
    ...props
}) => {
    const inOverflowMenu = !!useContext(OverflowMenuContext);
    if (inOverflowMenu) {
        return <IconizedContextMenuOption {...props} iconClassName={iconClassName} label={title} inputRef={inputRef} />;
    }

    return (
        <AccessibleButton {...props} title={title} className={classNames(className, iconClassName)} ref={inputRef}>
            {children}
        </AccessibleButton>
    );
};
