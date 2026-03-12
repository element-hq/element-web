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
import { Button, InlineSpinner, Tooltip } from "@vector-im/compound-web";

import { useI18n } from "../../utils/i18nContext";
import { Flex } from "../../utils/Flex";
import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ActionBarView.module.css";

export interface ActionBarViewSnapshot {
    showCancel: boolean;
    showDownload: boolean;
    showEdit: boolean;
    showExpandCollapse: boolean;
    showHide: boolean;
    showPinOrUnpin: boolean;
    showReact: boolean;
    showReply: boolean;
    showReplyInThread: boolean;
    showStartThread: boolean;
    showThreadForDeletedMessage: boolean;
    isDownloadEncrypted: boolean;
    isDownloadLoading: boolean;
    isFailed: boolean;
    isPinned: boolean;
    isQuoteExpanded: boolean;
}

export interface ActionBarViewActions {
    onCancelClick?: (anchor: HTMLElement | null) => void;
    onDownloadClick?: (anchor: HTMLElement | null) => void;
    onEditClick?: (anchor: HTMLElement | null) => void;
    onHideClick?: (anchor: HTMLElement | null) => void;
    onOptionsClick?: (anchor: HTMLElement | null) => void;
    onPinClick?: (anchor: HTMLElement | null) => void;
    onReactionsClick?: (anchor: HTMLElement | null) => void;
    onReplyClick?: (anchor: HTMLElement | null) => void;
    onReplyInThreadClick?: (anchor: HTMLElement | null) => void;
    onResendClick?: (anchor: HTMLElement | null) => void;
    onToggleThreadExpanded?: (anchor: HTMLElement | null) => void;
}

export type ActionBarViewModel = ViewModel<ActionBarViewSnapshot, ActionBarViewActions>;

interface ActionBarViewProps {
    /** The view model for the component. */
    vm: ActionBarViewModel;
    /** Optional CSS class names to apply to the component container.*/
    className?: string;
}

export function ActionBarView({ vm, className }: Readonly<ActionBarViewProps>): JSX.Element | null {
    const { translate: _t } = useI18n();
    const cancelTriggerRef = useRef<HTMLButtonElement>(null);
    const downloadTriggerRef = useRef<HTMLButtonElement>(null);
    const editTriggerRef = useRef<HTMLButtonElement>(null);
    const expandTriggerRef = useRef<HTMLButtonElement>(null);
    const hideTriggerRef = useRef<HTMLButtonElement>(null);
    const pinTriggerRef = useRef<HTMLButtonElement>(null);
    const reactTriggerRef = useRef<HTMLButtonElement>(null);
    const replyTriggerRef = useRef<HTMLButtonElement>(null);
    const replyInThreadTriggerRef = useRef<HTMLButtonElement>(null);
    const resendTriggerRef = useRef<HTMLButtonElement>(null);
    const optionsTriggerRef = useRef<HTMLButtonElement>(null);
    const {
        showCancel,
        showDownload,
        showEdit,
        showExpandCollapse,
        showHide,
        showPinOrUnpin,
        showReact,
        showReply,
        showReplyInThread,
        showStartThread,
        showThreadForDeletedMessage,
        isDownloadEncrypted,
        isDownloadLoading,
        isFailed,
        isPinned,
        isQuoteExpanded,
    } = useViewModel(vm);

    const menuItems: JSX.Element[] = [];

    if (showEdit) {
        menuItems.push(
            <Tooltip description={_t("action|edit")} placement="top" key="edit">
                <Button
                    ref={editTriggerRef}
                    kind="tertiary"
                    size="sm"
                    iconOnly={true}
                    aria-label={_t("action|edit")}
                    onClick={() => vm.onEditClick?.(editTriggerRef.current)}
                    className={styles.toolbar_item}
                    Icon={EditIcon}
                />
            </Tooltip>,
        );
    }

    if (showPinOrUnpin) {
        const description = isPinned ? _t("action|unpin") : _t("action|pin");
        menuItems.push(
            <Tooltip description={description} placement="top" key="pin">
                <Button
                    ref={pinTriggerRef}
                    kind="tertiary"
                    size="sm"
                    iconOnly={true}
                    aria-label={description}
                    onClick={() => vm.onPinClick?.(pinTriggerRef.current)}
                    className={styles.toolbar_item}
                    Icon={isPinned ? UnpinIcon : PinIcon}
                />
            </Tooltip>,
        );
    }

    const cancelSendingButton = (
        <Tooltip description={_t("action|delete")} placement="top" key="cancel">
            <Button
                ref={cancelTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|delete")}
                onClick={() => vm.onCancelClick?.(cancelTriggerRef.current)}
                className={styles.toolbar_item}
                Icon={DeleteIcon}
            />
        </Tooltip>
    );

    const threadTooltipDescription = showStartThread
        ? _t("action|reply_in_thread")
        : _t("threads|error_start_thread_existing_relation");
    const threadTooltipButton = (
        <Tooltip description={threadTooltipDescription} placement="top" key="reply_thread">
            <Button
                ref={replyInThreadTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={threadTooltipDescription}
                disabled={!showStartThread}
                onClick={() => vm.onReplyInThreadClick?.(replyInThreadTriggerRef.current)}
                className={styles.toolbar_item}
                Icon={ThreadsIcon}
            />
        </Tooltip>
    );

    if (showCancel && isFailed) {
        menuItems.splice(
            0,
            0,
            <Tooltip description={_t("action|retry")} placement="top" key="resend">
                <Button
                    ref={resendTriggerRef}
                    kind="tertiary"
                    size="sm"
                    iconOnly={true}
                    aria-label={_t("action|retry")}
                    onClick={() => vm.onResendClick?.(resendTriggerRef.current)}
                    className={styles.toolbar_item}
                    Icon={RestartIcon}
                />
            </Tooltip>,
        );
        menuItems.push(cancelSendingButton);
    } else {
        if (showReply) {
            if (showReplyInThread) {
                menuItems.splice(0, 0, threadTooltipButton);
            }
            menuItems.splice(
                0,
                0,
                <Tooltip description={_t("action|reply")} placement="top" key="reply">
                    <Button
                        ref={replyTriggerRef}
                        kind="tertiary"
                        size="sm"
                        iconOnly={true}
                        aria-label={_t("action|reply")}
                        onClick={() => vm.onReplyClick?.(replyTriggerRef.current)}
                        className={styles.toolbar_item}
                        Icon={ReplyIcon}
                    />
                </Tooltip>,
            );
        }

        if (showReact) {
            menuItems.splice(
                0,
                0,
                <Tooltip description={_t("action|react")} placement="top" key="react">
                    <Button
                        ref={reactTriggerRef}
                        kind="tertiary"
                        size="sm"
                        iconOnly={true}
                        aria-label={_t("action|react")}
                        onClick={() => vm.onReactionsClick?.(reactTriggerRef.current)}
                        className={styles.toolbar_item}
                        Icon={ReactionAddIcon}
                    />
                </Tooltip>,
            );
        }
        if (showDownload) {
            let downloadTitle = isDownloadEncrypted
                ? _t("timeline|download_action_decrypting")
                : _t("timeline|download_action_downloading");
            downloadTitle = isDownloadLoading ? _t("action|download") : downloadTitle;

            menuItems.splice(
                0,
                0,
                <Tooltip description={downloadTitle} placement="top" key="download">
                    <Button
                        ref={downloadTriggerRef}
                        kind="tertiary"
                        size="sm"
                        iconOnly={true}
                        aria-label={downloadTitle}
                        onClick={() => vm.onDownloadClick?.(downloadTriggerRef.current)}
                        className={styles.toolbar_item}
                        Icon={isDownloadLoading ? InlineSpinner : DownloadIcon}
                    />
                </Tooltip>,
            );
        }
        if (showHide) {
            menuItems.splice(
                0,
                0,
                <Tooltip description={_t("action|hide")} placement="top" key="hide">
                    <Button
                        ref={hideTriggerRef}
                        kind="tertiary"
                        size="sm"
                        iconOnly={true}
                        aria-label={_t("action|hide")}
                        onClick={() => vm.onHideClick?.(hideTriggerRef.current)}
                        className={styles.toolbar_item}
                        Icon={VisibilityOffIcon}
                    />
                </Tooltip>,
            );
        }
        if (showThreadForDeletedMessage) {
            menuItems.unshift(threadTooltipButton);
        }

        if (showCancel) {
            menuItems.push(cancelSendingButton);
        }

        if (showExpandCollapse) {
            const description = isQuoteExpanded
                ? _t("timeline|mab|collapse_reply_chain")
                : _t("timeline|mab|expand_reply_chain");

            menuItems.push(
                <Tooltip description={description} placement="top" key="expand">
                    <Button
                        ref={expandTriggerRef}
                        kind="tertiary"
                        size="sm"
                        iconOnly={true}
                        aria-label={description}
                        onClick={() => vm.onToggleThreadExpanded?.(expandTriggerRef.current)}
                        className={styles.toolbar_item}
                        Icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
                    />
                </Tooltip>,
            );
        }

        menuItems.push(
            <Tooltip description={_t("common|options")} placement="top" key="options">
                <Button
                    ref={optionsTriggerRef}
                    kind="tertiary"
                    size="sm"
                    iconOnly={true}
                    aria-label={_t("common|options")}
                    onClick={() => vm.onOptionsClick?.(optionsTriggerRef.current)}
                    className={styles.toolbar_item}
                    Icon={OverflowHorizontalIcon}
                />
            </Tooltip>,
        );
    }

    return (
        <Flex
            role="toolbar"
            aria-label={_t("timeline|mab|label")}
            aria-live="off"
            className={classNames(className, styles.toolbar)}
        >
            {menuItems}
        </Flex>
    );
}
