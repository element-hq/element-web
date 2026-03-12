/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, useContext } from "react";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";
import { ImageIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import ContextMenu, { aboveLeftOf, type MenuProps, useContextMenu } from "../../structures/ContextMenu";
import { GifPicker } from "../gifpicker/GifPicker";
import { CollapsibleButton } from "./CollapsibleButton";
import { OverflowMenuContext } from "./MessageComposerButtons";

interface GifButtonProps {
    relation?: IEventRelation;
    menuPosition?: MenuProps;
    className?: string;
}

/**
 * Composer toolbar button that opens the GIF search picker.
 * Follows the same pattern as EmojiButton.
 */
export function GifButton({ relation, menuPosition, className }: GifButtonProps): JSX.Element {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed && button.current) {
        const position = menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect());
        const onFinished = (): void => {
            closeMenu();
            overflowMenuCloser?.();
        };

        contextMenu = (
            <ContextMenu {...position} onFinished={onFinished} managed={false} focusLock>
                <GifPicker relation={relation} onFinished={onFinished} />
            </ContextMenu>
        );
    }

    const computedClassName = classNames("mx_GifButton", className, {
        mx_GifButton_highlight: menuDisplayed,
    });

    return (
        <>
            <CollapsibleButton
                className={computedClassName}
                onClick={openMenu}
                title={_t("common|gif")}
                inputRef={button}
            >
                <ImageIcon />
            </CollapsibleButton>

            {contextMenu}
        </>
    );
}
