/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import classNames from "classnames";
import React, { type JSX, useContext, useState } from "react";
import {
    type IEventRelation,
    type MatrixEvent,
    type Room,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import ContextMenu, {
    aboveLeftOf,
    type MenuProps,
    useContextMenu,
} from "../../structures/ContextMenu";
import EmojiPicker from "../emojipicker/EmojiPicker";
import { CollapsibleButton, OverflowMenuContext } from "./CollapsibleButton";
import RemoteStickerTab from "./RemoteStickerTab";
import PersonalStickerTab from "./PersonalStickerTab";
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

/**
 * Element's native picker remains the normal emoji tab. The adjacent personal
 * sticker and cloud tabs follow Spark's compact three-tab board.
 */
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
    const [activeTab, setActiveTab] = useState<"sticker" | "emoji" | "cloud">(
        "emoji"
    );
    const [preferInlineEmoticon, setPreferInlineEmoticon] = useState(false);

    const rememberComposerFocus = (): void => {
        const activeElement = document.activeElement;
        setPreferInlineEmoticon(
            activeElement instanceof HTMLElement &&
                activeElement.matches(
                    ".mx_BasicMessageComposer_input[contenteditable='true'], .mx_WysiwygComposer_Editor_content[contenteditable='true']"
                )
        );
    };

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed && button.current) {
        const position =
            menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect());
        const onFinished = (): void => {
            closeMenu();
            overflowMenuCloser?.();
        };
        const cloudBoardEnabled = Boolean(room && getRemoteStickerIndexUrl());
        const threadId =
            relation?.rel_type === THREAD_RELATION_TYPE.name
                ? relation.event_id
                : null;

        const cloudBoard = (personalStickerTab: boolean): JSX.Element =>
            personalStickerTab ? (
                <PersonalStickerTab
                    room={room!}
                    threadId={threadId}
                    replyToEvent={replyToEvent}
                    onSent={onFinished}
                />
            ) : (
                <RemoteStickerTab
                    room={room!}
                    threadId={threadId}
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
            );

        contextMenu = (
            <ContextMenu
                {...position}
                onFinished={onFinished}
                managed={false}
                focusLock
            >
                <div className="mx_RemoteStickerTab_emojiPanel mx_EmojiBoardShell">
                    {cloudBoardEnabled && (
                        <div
                            className="mx_RemoteStickerTab_tabs mx_EmojiBoardShell_tabs"
                            role="tablist"
                        >
                            <CollapsibleButton
                                className={classNames(
                                    "mx_RemoteStickerTab_tab",
                                    {
                                        mx_RemoteStickerTab_tab_active:
                                            activeTab === "sticker",
                                    }
                                )}
                                title="贴纸"
                                onClick={() => setActiveTab("sticker")}
                            >
                                贴纸
                            </CollapsibleButton>
                            <CollapsibleButton
                                className={classNames(
                                    "mx_RemoteStickerTab_tab",
                                    {
                                        mx_RemoteStickerTab_tab_active:
                                            activeTab === "emoji",
                                    }
                                )}
                                title="表情"
                                onClick={() => setActiveTab("emoji")}
                            >
                                表情
                            </CollapsibleButton>
                            <CollapsibleButton
                                className={classNames(
                                    "mx_RemoteStickerTab_tab",
                                    {
                                        mx_RemoteStickerTab_tab_active:
                                            activeTab === "cloud",
                                    }
                                )}
                                title="云端"
                                onClick={() => setActiveTab("cloud")}
                            >
                                云端
                            </CollapsibleButton>
                        </div>
                    )}
                    <div className="mx_EmojiBoardShell_body">
                        {!cloudBoardEnabled || activeTab === "emoji" ? (
                            <EmojiPicker
                                onChoose={addEmoji}
                                onFinished={onFinished}
                            />
                        ) : (
                            cloudBoard(activeTab === "sticker")
                        )}
                    </div>
                </div>
            </ContextMenu>
        );
    }

    return (
        <>
            <CollapsibleButton
                className={classNames("mx_EmojiButton", className, {
                    mx_EmojiButton_highlight: menuDisplayed,
                })}
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
