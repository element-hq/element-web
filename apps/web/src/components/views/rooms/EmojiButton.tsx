/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, useContext, useState } from "react";
import { type IEventRelation, type MatrixEvent, type Room, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import ContextMenu, { aboveLeftOf, type MenuProps, useContextMenu } from "../../structures/ContextMenu";
import EmojiPicker from "../emojipicker/EmojiPicker";
import { CollapsibleButton, OverflowMenuContext } from "./CollapsibleButton";
import RemoteStickerTab from "./RemoteStickerTab";
import { getRemoteStickerIndexUrl } from "../../../features/remote-stickers/RemoteStickerIndex";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { type TimelineRenderingType } from "../../../contexts/RoomContext";

interface IEmojiButtonProps {
    addEmoji: (unicode: string) => boolean;
    menuPosition?: MenuProps;
    className?: string;
    room?: Room;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    timelineRenderingType?: TimelineRenderingType;
}

export function EmojiButton({
    addEmoji,
    menuPosition,
    className,
    room,
    relation,
    replyToEvent,
    timelineRenderingType,
}: IEmojiButtonProps): JSX.Element {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();
    const [cloudTab, setCloudTab] = useState(false);
    const [preferInlineEmoticon, setPreferInlineEmoticon] = useState(false);

    const rememberComposerFocus = (): void => {
        const activeElement = document.activeElement;
        const focusedEditor =
            activeElement instanceof HTMLElement &&
            activeElement.matches(
                ".mx_BasicMessageComposer_input[contenteditable='true'], .mx_WysiwygComposer_Editor_content[contenteditable='true']",
            );
        setPreferInlineEmoticon(focusedEditor);
    };

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed && button.current) {
        const position = menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect());
        const onFinished = (): void => {
            closeMenu();
            overflowMenuCloser?.();
        };

        const cloudEnabled = Boolean(room && getRemoteStickerIndexUrl());
        contextMenu = (
            <ContextMenu {...position} onFinished={onFinished} managed={false} focusLock>
                {cloudEnabled && room ? (
                    <div className="mx_RemoteStickerTab_emojiPanel">
                        <div className="mx_RemoteStickerTab_tabs">
                            <CollapsibleButton
                                className={classNames("mx_RemoteStickerTab_tab", {
                                    mx_RemoteStickerTab_tab_active: !cloudTab,
                                })}
                                title="Emoji"
                                onClick={() => setCloudTab(false)}
                            >
                                Emoji
                            </CollapsibleButton>
                            <CollapsibleButton
                                className={classNames("mx_RemoteStickerTab_tab", {
                                    mx_RemoteStickerTab_tab_active: cloudTab,
                                })}
                                title="云端表情"
                                onClick={() => setCloudTab(true)}
                            >
                                云端表情
                            </CollapsibleButton>
                        </div>
                        {cloudTab ? (
                            <RemoteStickerTab
                                room={room}
                                threadId={relation?.rel_type === THREAD_RELATION_TYPE.name ? relation.event_id : null}
                                replyToEvent={replyToEvent}
                                preferInlineEmoticon={preferInlineEmoticon}
                                onInsertEmoticon={(emoticon) => {
                                    dis.dispatch<ComposerInsertPayload>({
                                        action: Action.ComposerInsert,
                                        text: emoticon.text,
                                        customEmoticon: emoticon,
                                        timelineRenderingType: timelineRenderingType!,
                                    });
                                    onFinished();
                                }}
                                onSent={onFinished}
                            />
                        ) : (
                            <EmojiPicker onChoose={addEmoji} onFinished={onFinished} />
                        )}
                    </div>
                ) : (
                    <EmojiPicker onChoose={addEmoji} onFinished={onFinished} />
                )}
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
                onMouseDown={rememberComposerFocus}
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
