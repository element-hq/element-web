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
+import { EmojiPickerWithRecents } from "../../../emojipicker/EmojiPickerWithRecents";
+import { type CustomEmote } from "../../../custom-emotes";

interface IEmojiButtonProps {
    addEmoji: (unicode: string) => boolean;
    addCustomEmote?: (emote: CustomEmote) => boolean;
    customEmotes?: CustomEmote[];
    menuPosition?: MenuProps;
    className?: string;
}

export function EmojiButton({
    addEmoji,
    addCustomEmote,
    customEmotes,
    menuPosition,
    className,
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

        contextMenu = (
            <ContextMenu {...position} onFinished={onFinished} managed={false} focusLock>
+                <EmojiPickerWithRecents
+                    onChoose={addEmoji}
+                    customEmotes={customEmotes}
+                    onChooseCustomEmote={addCustomEmote}
+                    onFinished={onFinished}
+                />
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
