/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import ContextMenuIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { contextMenuBelow, ContextMenuButton, useContextMenu } from "../../structures/ContextMenu";
import { type ButtonProps } from "../elements/AccessibleButton";
import IconizedContextMenu, { IconizedContextMenuOptionList } from "./IconizedContextMenu";

type KebabContextMenuProps = Partial<ButtonProps<any>> & {
    options: React.ReactNode[];
    title: string;
};

export const KebabContextMenu: React.FC<KebabContextMenuProps> = ({ options, title, ...props }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    return (
        <>
            <ContextMenuButton {...props} onClick={openMenu} title={title} isExpanded={menuDisplayed} ref={button}>
                <ContextMenuIcon className="mx_KebabContextMenu_icon" />
            </ContextMenuButton>
            {menuDisplayed && (
                <IconizedContextMenu
                    onFinished={closeMenu}
                    compact
                    rightAligned
                    closeOnInteraction
                    {...contextMenuBelow(button.current!.getBoundingClientRect())}
                >
                    <IconizedContextMenuOptionList>{options}</IconizedContextMenuOptionList>
                </IconizedContextMenu>
            )}
        </>
    );
};
