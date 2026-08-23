/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, useContext } from "react";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import ContextMenu, { aboveLeftOf, type MenuProps, useContextMenu } from "../../structures/ContextMenu";
import { CollapsibleButton, OverflowMenuContext } from "./CollapsibleButton";
import { EmojiPickerWithRecents } from "../../../emojipicker/EmojiPickerWithRecents";
import { type StickerPickerMode } from "./Stickerpicker";

interface IEmojiButtonProps {
    addEmoji: (unicode: string) => boolean;
    menuPosition?: MenuProps;
    className?: string;
    openStickerPickerMode: (mode: StickerPickerMode) => void;
}

export function EmojiButton({
    addEmoji,
    menuPosition,
    className,
    openStickerPickerMode,
}: IEmojiButtonProps): JSX.Element {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed && button.current) {
        const position = menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect());
        const onFinished = (): void => {
            closeMenu();
            overflowMenuCloser?.();
        };

        const switchToStickerPicker = (mode: StickerPickerMode): void => {
            onFinished();
            window.setTimeout(() => openStickerPickerMode(mode), 0);
        };

        contextMenu = (
            <ContextMenu {...position} onFinished={onFinished} managed={false} focusLock>
                <div className="mx_AshramPickerFrame">
                    <div className="mx_AshramPickerTabs" role="tablist" aria-label="Composer picker">
                        <button
                            type="button"
                            className="mx_AshramPickerTab mx_AshramPickerTab_active"
                            role="tab"
                            aria-selected="true"
                        >
                            Emoji
                        </button>
                        <button
                            type="button"
                            className="mx_AshramPickerTab"
                            role="tab"
                            aria-selected="false"
                            onClick={() => switchToStickerPicker("stickers")}
                        >
                            Stickers
                        </button>
                        <button
                            type="button"
                            className="mx_AshramPickerTab"
                            role="tab"
                            aria-selected="false"
                            onClick={() => switchToStickerPicker("gifs")}
                        >
                            GIFs
                        </button>
                    </div>
                    <EmojiPickerWithRecents onChoose={addEmoji} onFinished={onFinished} />
                </div>
            </ContextMenu>
        );
    }

    const computedClassName = classNames("mx_EmojiButton", className, {
        mx_EmojiButton_highlight: menuDisplayed,
    });

    // TODO: replace ContextMenuTooltipButton with a unified representation of
    // the header buttons and the right panel buttons
    return (
        <>
            <CollapsibleButton
                id="emojiButton"
                className={computedClassName}
                onClick={openMenu}
                title={_t("common|emoji")}
                inputRef={button}
            >
                <ReactionIcon />
            </CollapsibleButton>

            {contextMenu}
        </>
    );
}
