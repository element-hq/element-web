/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useRef } from "react";
import classNames from "classnames";
import {
    CollapseIcon,
    DeleteIcon,
    EditIcon,
    ExpandIcon,
    PinIcon,
    ReplyIcon,
    RestartIcon,
    UnpinIcon,
    ThreadsIcon,
    VisibilityOffIcon,
    DownloadIcon,
    OverflowHorizontalIcon,
    ReactionAddIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Menu, MenuItem, InlineSpinner, Tooltip } from "@vector-im/compound-web";

import { useI18n } from "../../utils/i18nContext";
import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ActionBarView.module.css";

export interface ActionBarViewSnapshot {
    /**
     * The edge along which the menu and trigger will be aligned.
     * @default center
     */
    align?: "start" | "center" | "end";
    /**
     * The side of the trigger on which to place the menu. Note that the menu may
     * still end up on a different side than the one you request if there isn't
     * enough space.
     * @default bottom
     */
    side?: "top" | "right" | "bottom" | "left";

    canCancel: boolean;
    canEdit: boolean;
    canPinOrUnpin: boolean;
    canReact: boolean;
    canSendMessages: boolean;
    canStartThread: boolean;

    showDownloadAction: boolean;
    showExpandCollapseAction: boolean;
    showHideAction: boolean;
    showReplyInThreadAction: boolean;
    showThreadForDeletedMessage: boolean;

    isContentActionable: boolean;
    isDownloadEncrypted: boolean;
    isDownloadLoading: boolean;
    isFailed: boolean;
    isPinned: boolean;
    isQuoteExpanded: boolean;
}

export interface ActionBarViewActions {
    onCancelClick?: (anchor: HTMLDivElement | null) => void;
    onDownloadClick?: (anchor: HTMLDivElement | null) => void;
    onEditClick?: (anchor: HTMLDivElement | null) => void;
    onHideClick?: (anchor: HTMLDivElement | null) => void;
    onOptionsClick?: (anchor: HTMLDivElement | null) => void;
    onPinClick?: (anchor: HTMLDivElement | null) => void;
    onReactionsClick?: (anchor: HTMLDivElement | null) => void;
    onReplyClick?: (anchor: HTMLDivElement | null) => void;
    onReplyInThreadClick?: (anchor: HTMLDivElement | null) => void;
    onResendClick?: (anchor: HTMLDivElement | null) => void;
    onToggleThreadExpanded?: (anchor: HTMLDivElement | null) => void;
}

export type ActionBarViewModel = ViewModel<ActionBarViewSnapshot, ActionBarViewActions>;

interface ActionBarViewProps {
    /** The view model for the component. */
    vm: ActionBarViewModel;
    /** Optional CSS class names to apply to the component container.*/
    className?: string;
    /** The element used as the menu anchor. */
    anchor: React.ReactNode;
    /** Whether the menu should be rendered. */
    open: boolean;
}

export function ActionBarView({ vm, className, anchor, open }: Readonly<ActionBarViewProps>): JSX.Element | null {
    const { translate: _t } = useI18n();
    const cancelTriggerRef = useRef<HTMLDivElement>(null);
    const downloadTriggerRef = useRef<HTMLDivElement>(null);
    const editTriggerRef = useRef<HTMLDivElement>(null);
    const expandTriggerRef = useRef<HTMLDivElement>(null);
    const hideTriggerRef = useRef<HTMLDivElement>(null);
    const pinTriggerRef = useRef<HTMLDivElement>(null);
    const reactTriggerRef = useRef<HTMLDivElement>(null);
    const replyTriggerRef = useRef<HTMLDivElement>(null);
    const replyInThreadTriggerRef = useRef<HTMLDivElement>(null);
    const resendTriggerRef = useRef<HTMLDivElement>(null);
    const optionsTriggerRef = useRef<HTMLDivElement>(null);
    const {
        side,
        align,
        canEdit,
        canPinOrUnpin,
        isPinned,
        canCancel,
        isFailed,
        isContentActionable,
        canSendMessages,
        canReact,
        canStartThread,
        isDownloadEncrypted,
        isDownloadLoading,
        showReplyInThreadAction,
        showThreadForDeletedMessage,
        showDownloadAction,
        showHideAction,
        showExpandCollapseAction,
        isQuoteExpanded,
    } = useViewModel(vm);

    if (!open) {
        return null;
    }

    const menuItems: JSX.Element[] = [];

    if (canEdit) {
        menuItems.push(
            <div ref={editTriggerRef} key="edit">
                <Tooltip description={_t("action|edit")} placement="top">
                    <MenuItem
                        as="div"
                        label={null}
                        aria-label={_t("action|edit")}
                        onSelect={() => vm.onEditClick?.(editTriggerRef.current)}
                        hideChevron={true}
                        className={styles.menu_item}
                        Icon={EditIcon}
                    />
                </Tooltip>
            </div>,
        );
    }

    if (canPinOrUnpin) {
        const description = isPinned ? _t("action|unpin") : _t("action|pin");
        menuItems.push(
            <div ref={pinTriggerRef} key="pin">
                <Tooltip description={description} placement="top">
                    <MenuItem
                        as="div"
                        label={null}
                        aria-label={description}
                        onSelect={() => vm.onPinClick?.(pinTriggerRef.current)}
                        hideChevron={true}
                        className={styles.menu_item}
                        Icon={isPinned ? UnpinIcon : PinIcon}
                    />
                </Tooltip>
            </div>,
        );
    }

    const cancelSendingButton = (
        <div ref={cancelTriggerRef} key="cancel">
            <Tooltip description={_t("action|delete")} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={_t("action|delete")}
                    onSelect={() => vm.onCancelClick?.(cancelTriggerRef.current)}
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={DeleteIcon}
                />
            </Tooltip>
        </div>
    );

    const threadTooltipDescription = canStartThread
        ? _t("action|reply_in_thread")
        : _t("threads|error_start_thread_existing_relation");
    const threadTooltipButton = (
        <div ref={replyInThreadTriggerRef} key="reply_thread">
            <Tooltip description={threadTooltipDescription} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={threadTooltipDescription}
                    onSelect={
                        canStartThread && vm.onReplyInThreadClick
                            ? () => vm.onReplyInThreadClick?.(replyInThreadTriggerRef.current)
                            : null
                    }
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={ThreadsIcon}
                />
            </Tooltip>
        </div>
    );

    if (canCancel && isFailed) {
        menuItems.splice(
            0,
            0,
            <div ref={resendTriggerRef} key="resend">
                <Tooltip description={_t("action|retry")} placement="top">
                    <MenuItem
                        as="div"
                        label={null}
                        aria-label={_t("action|retry")}
                        onSelect={() => vm.onResendClick?.(resendTriggerRef.current)}
                        hideChevron={true}
                        className={styles.menu_item}
                        Icon={RestartIcon}
                    />
                </Tooltip>
            </div>,
        );
        menuItems.push(cancelSendingButton);
    } else {
        if (isContentActionable) {
            if (canSendMessages) {
                if (showReplyInThreadAction) {
                    menuItems.splice(0, 0, threadTooltipButton);
                }
                menuItems.splice(
                    0,
                    0,
                    <div ref={replyTriggerRef} key="reply">
                        <Tooltip description={_t("action|reply")} placement="top">
                            <MenuItem
                                as="div"
                                label={null}
                                aria-label={_t("action|reply")}
                                onSelect={() => vm.onReplyClick?.(replyTriggerRef.current)}
                                hideChevron={true}
                                className={styles.menu_item}
                                Icon={ReplyIcon}
                            />
                        </Tooltip>
                    </div>,
                );
            }

            if (canReact) {
                menuItems.splice(
                    0,
                    0,
                    <div ref={reactTriggerRef} key="react">
                        <Tooltip description={_t("action|react")} placement="top">
                            <MenuItem
                                as="div"
                                label={null}
                                aria-label={_t("action|react")}
                                onSelect={() => vm.onReactionsClick?.(reactTriggerRef.current)}
                                hideChevron={true}
                                className={styles.menu_item}
                                Icon={ReactionAddIcon}
                            />
                        </Tooltip>
                    </div>,
                );
            }
            if (showDownloadAction) {
                let downloadTitle = isDownloadEncrypted
                    ? _t("timeline|download_action_decrypting")
                    : _t("timeline|download_action_downloading");
                downloadTitle = isDownloadLoading ? _t("action|download") : downloadTitle;

                menuItems.splice(
                    0,
                    0,
                    <div ref={downloadTriggerRef} key="download">
                        <Tooltip description={downloadTitle} placement="top">
                            <MenuItem
                                as="div"
                                label={null}
                                aria-label={downloadTitle}
                                onSelect={() => vm.onDownloadClick?.(downloadTriggerRef.current)}
                                hideChevron={true}
                                className={styles.menu_item}
                                Icon={isDownloadLoading ? InlineSpinner : DownloadIcon}
                            />
                        </Tooltip>
                    </div>,
                );
            }
            if (showHideAction) {
                menuItems.splice(
                    0,
                    0,
                    <div ref={hideTriggerRef} key="hide">
                        <Tooltip description={_t("action|hide")} placement="top">
                            <MenuItem
                                as="div"
                                label={null}
                                aria-label={_t("action|hide")}
                                onSelect={() => vm.onHideClick?.(hideTriggerRef.current)}
                                hideChevron={true}
                                className={styles.menu_item}
                                Icon={VisibilityOffIcon}
                            />
                        </Tooltip>
                    </div>,
                );
            }
        } else if (showThreadForDeletedMessage) {
            menuItems.unshift(threadTooltipButton);
        }

        if (canCancel) {
            menuItems.push(cancelSendingButton);
        }

        if (showExpandCollapseAction) {
            const description = isQuoteExpanded
                ? _t("timeline|mab|collapse_reply_chain")
                : _t("timeline|mab|expand_reply_chain");

            menuItems.push(
                <div ref={expandTriggerRef} key="expand">
                    <Tooltip description={description} placement="top">
                        <MenuItem
                            as="div"
                            //caption={_t(ALTERNATE_KEY_NAME[Key.SHIFT]) + " + " + _t("action|click")}
                            //label={_t("keyboard|shift") + " + " + _t("action|click")}
                            aria-label={description}
                            label={null}
                            onSelect={() => vm.onToggleThreadExpanded?.(expandTriggerRef.current)}
                            hideChevron={true}
                            className={styles.menu_item}
                            Icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
                        />
                    </Tooltip>
                </div>,
            );
        }

        menuItems.push(
            <div ref={optionsTriggerRef} key="options">
                <Tooltip description={_t("common|options")} placement="top">
                    <MenuItem
                        as="div"
                        label={null}
                        aria-label={_t("common|options")}
                        onSelect={() => vm.onOptionsClick?.(optionsTriggerRef.current)}
                        hideChevron={true}
                        className={styles.menu_item}
                        Icon={OverflowHorizontalIcon}
                    />
                </Tooltip>
            </div>,
        );
    }

    return (
        <Menu
            side={side}
            align={align}
            open={open}
            onOpenChange={() => {}}
            trigger={anchor}
            title={_t("timeline|mab|label")}
            showTitle={false}
            aria-live="off"
            className={classNames(className, styles.menu)}
        >
            {menuItems}
        </Menu>
    );
}
