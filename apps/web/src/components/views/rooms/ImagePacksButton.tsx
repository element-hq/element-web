/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useContext, useEffect } from "react";
import classNames from "classnames";

import { CollapsibleButton, OverflowMenuContext } from "./CollapsibleButton";
import { type MenuProps } from "../../structures/ContextMenu";
import ContextMenu, { ChevronFace, aboveLeftOf, useContextMenu } from "../../structures/ContextMenu";
import { StickerIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import ImagePacksPicker from "./ImagePacksPicker";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";
import { ImagePackStore } from "../../../stores/image-packs/ImagePackStore";

interface IProps {
    menuPosition?: MenuProps;
    className?: string;
}

export const ImagePacksButton: React.FC<IProps> = ({ menuPosition, className }) => {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const roomContext = useScopedRoomContext("room");
    const room = roomContext?.room;

    useEffect(() => {
        if (room) {
            ImagePackStore.instance.preloadRoomPacks(room.roomId);
        }
    }, [room]);

    if (!room) return null;

    let position;
    if (menuPosition) {
        position = menuPosition;
    } else if (button.current) {
        position = aboveLeftOf(button.current.getBoundingClientRect());
    }

    const onFinished = (): void => {
        closeMenu();
        overflowMenuCloser?.();
    };

    const computedClassName = classNames("mx_MessageComposer_button", className, {
        mx_MessageComposer_button_highlight: menuDisplayed,
    });

    return (
        <React.Fragment>
            <CollapsibleButton
                className={computedClassName}
                id="mx_ImagePacksButton"
                onClick={openMenu}
                onMouseEnter={() => {
                    if (room) ImagePackStore.instance.preloadRoomPacks(room.roomId);
                }}
                title={"Stickers & Emotes"}
                inputRef={button}
            >
                <StickerIcon className="mx_Icon mx_Icon_16" />
            </CollapsibleButton>
            {menuDisplayed && position && (
                <ContextMenu
                    {...position}
                    chevronFace={ChevronFace.None}
                    onFinished={onFinished}
                    menuWidth={350}
                    menuHeight={400}
                    managed={false}
                    focusLock
                >
                    <ImagePacksPicker room={room} onFinished={onFinished} />
                </ContextMenu>
            )}
        </React.Fragment>
    );
};

export default ImagePacksButton;
