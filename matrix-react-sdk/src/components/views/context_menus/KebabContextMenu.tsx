/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { Icon as ContextMenuIcon } from "../../../../res/img/element-icons/context-menu.svg";
import { ChevronFace, ContextMenuButton, MenuProps, useContextMenu } from "../../structures/ContextMenu";
import AccessibleButton from "../elements/AccessibleButton";
import IconizedContextMenu, { IconizedContextMenuOptionList } from "./IconizedContextMenu";

const contextMenuBelow = (elementRect: DOMRect): MenuProps => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.scrollX + elementRect.width;
    const top = elementRect.bottom + window.scrollY;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

interface KebabContextMenuProps extends Partial<React.ComponentProps<typeof AccessibleButton>> {
    options: React.ReactNode[];
    title: string;
}

export const KebabContextMenu: React.FC<KebabContextMenuProps> = ({ options, title, ...props }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    return (
        <>
            <ContextMenuButton {...props} onClick={openMenu} title={title} isExpanded={menuDisplayed} inputRef={button}>
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
