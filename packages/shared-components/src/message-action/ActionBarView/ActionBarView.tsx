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

/**
 * Snapshot state for the message action toolbar.
 *
 * The flags intentionally model which actions are available for the current
 * message so the view can stay stateless and only render the relevant controls.
 */
export interface ActionBarViewSnapshot {
    /** Show the delete action for the message. */
    showCancel: boolean;
    /** Show the download action for media messages. */
    showDownload: boolean;
    /** Show the edit action when the message can be edited. */
    showEdit: boolean;
    /** Show the expand or collapse action for a reply chain. */
    showExpandCollapse: boolean;
    /** Show the hide action for visible media. */
    showHide: boolean;
    /** Show the pin or unpin action. */
    showPinOrUnpin: boolean;
    /** Show the add reaction action. */
    showReact: boolean;
    /** Show the reply action. */
    showReply: boolean;
    /** Show the reply in thread action. */
    showReplyInThread: boolean;
    /** Show the thread action for deleted messages that still have a thread context. */
    showThreadForDeletedMessage: boolean;
    /** Whether the current download is for encrypted media. */
    isDownloadEncrypted: boolean;
    /** Whether a media download or decryption is currently in progress. */
    isDownloadLoading: boolean;
    /** Whether the event is in a failed-to-send state. */
    isFailed: boolean;
    /** Whether the message is currently pinned. */
    isPinned: boolean;
    /** Whether the reply chain is currently expanded. */
    isQuoteExpanded: boolean;
    /** Whether starting or replying in a thread is allowed for this event. */
    isThreadReplyAllowed: boolean;
}

/**
 * Event handlers for toolbar actions.
 *
 * Each callback receives the triggering button so menus can be positioned from
 * the action anchor when needed.
 */
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

/**
 * Compact toolbar for message-level actions such as reply, react, edit,
 * download, and overflow options.
 *
 * Use `className` for host-level container styling, following standard React patterns.
 *
 * @example
 * ```tsx
 * <ActionBarView vm={actionBarVm} className="mx_MessageActionBar" />
 * ```
 */
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
        isThreadReplyAllowed,
        showThreadForDeletedMessage,
        isDownloadEncrypted,
        isDownloadLoading,
        isFailed,
        isPinned,
        isQuoteExpanded,
    } = useViewModel(vm);

    const handleContextMenu =
        (action: ((anchor: HTMLElement | null) => void) | undefined, ref: React.RefObject<HTMLButtonElement | null>) =>
        (event: React.MouseEvent<HTMLButtonElement>): void => {
            event.preventDefault();
            event.stopPropagation();
            action?.(ref.current);
        };

    const editButton = (
        <Tooltip description={_t("action|edit")} placement="top" key="edit">
            <Button
                ref={editTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|edit")}
                onClick={() => vm.onEditClick?.(editTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onEditClick, editTriggerRef)}
                className={styles.toolbar_item}
                Icon={EditIcon}
            />
        </Tooltip>
    );

    const pinDescription = isPinned ? _t("action|unpin") : _t("action|pin");
    const pinButton = (
        <Tooltip description={pinDescription} placement="top" key="pin">
            <Button
                ref={pinTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={pinDescription}
                onClick={() => vm.onPinClick?.(pinTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onPinClick, pinTriggerRef)}
                className={styles.toolbar_item}
                Icon={isPinned ? UnpinIcon : PinIcon}
            />
        </Tooltip>
    );

    const cancelButton = (
        <Tooltip description={_t("action|delete")} placement="top" key="cancel">
            <Button
                ref={cancelTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|delete")}
                onClick={() => vm.onCancelClick?.(cancelTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onCancelClick, cancelTriggerRef)}
                className={styles.toolbar_item}
                Icon={DeleteIcon}
            />
        </Tooltip>
    );

    const replyButton = (
        <Tooltip description={_t("action|reply")} placement="top" key="reply">
            <Button
                ref={replyTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|reply")}
                onClick={() => vm.onReplyClick?.(replyTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onReplyClick, replyTriggerRef)}
                className={styles.toolbar_item}
                Icon={ReplyIcon}
            />
        </Tooltip>
    );

    const reactButton = (
        <Tooltip description={_t("action|react")} placement="top" key="react">
            <Button
                ref={reactTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|react")}
                onClick={() => vm.onReactionsClick?.(reactTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onReactionsClick, reactTriggerRef)}
                className={styles.toolbar_item}
                Icon={ReactionAddIcon}
            />
        </Tooltip>
    );

    let downloadTitle = _t("action|download");
    if (isDownloadLoading) {
        downloadTitle = isDownloadEncrypted
            ? _t("timeline|download_action_decrypting")
            : _t("timeline|download_action_downloading");
    }
    const downloadButton = (
        <Tooltip description={downloadTitle} placement="top" key="download">
            <Button
                ref={downloadTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={downloadTitle}
                disabled={isDownloadLoading}
                onClick={() => vm.onDownloadClick?.(downloadTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onDownloadClick, downloadTriggerRef)}
                className={styles.toolbar_item}
                Icon={isDownloadLoading ? InlineSpinner : DownloadIcon}
            />
        </Tooltip>
    );

    const hideButton = (
        <Tooltip description={_t("action|hide")} placement="top" key="hide">
            <Button
                ref={hideTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|hide")}
                onClick={() => vm.onHideClick?.(hideTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onHideClick, hideTriggerRef)}
                className={styles.toolbar_item}
                Icon={VisibilityOffIcon}
            />
        </Tooltip>
    );

    const threadTooltipDescription = isThreadReplyAllowed
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
                disabled={!isThreadReplyAllowed}
                onClick={() => vm.onReplyInThreadClick?.(replyInThreadTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onReplyInThreadClick, replyInThreadTriggerRef)}
                className={styles.toolbar_item}
                Icon={ThreadsIcon}
            />
        </Tooltip>
    );

    const resendButton = (
        <Tooltip description={_t("action|retry")} placement="top" key="resend">
            <Button
                ref={resendTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|retry")}
                onClick={() => vm.onResendClick?.(resendTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onResendClick, resendTriggerRef)}
                className={styles.toolbar_item}
                Icon={RestartIcon}
            />
        </Tooltip>
    );

    const expandDescription = isQuoteExpanded
        ? _t("timeline|mab|collapse_reply_chain")
        : _t("timeline|mab|expand_reply_chain");
    const expandButton = (
        <Tooltip
            description={expandDescription}
            caption={`${_t("keyboard|shift")} + ${_t("action|click")}`}
            placement="top"
            key="expand"
        >
            <Button
                ref={expandTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={expandDescription}
                onClick={() => vm.onToggleThreadExpanded?.(expandTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onToggleThreadExpanded, expandTriggerRef)}
                className={styles.toolbar_item}
                Icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
            />
        </Tooltip>
    );

    const optionsButton = (
        <Tooltip description={_t("common|options")} placement="top" key="options">
            <Button
                ref={optionsTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("common|options")}
                onClick={() => vm.onOptionsClick?.(optionsTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onOptionsClick, optionsTriggerRef)}
                className={styles.toolbar_item}
                Icon={OverflowHorizontalIcon}
            />
        </Tooltip>
    );

    const menuItems: JSX.Element[] = [];

    if (showCancel && isFailed) {
        menuItems.push(resendButton, cancelButton);
    } else {
        if (showHide) {
            menuItems.push(hideButton);
        }
        if (showDownload) {
            menuItems.push(downloadButton);
        }
        if (showReact) {
            menuItems.push(reactButton);
        }
        if (!showReply && showThreadForDeletedMessage) {
            menuItems.push(threadTooltipButton);
        }
        if (showReply) {
            menuItems.push(replyButton);
        }
        if (showReply && showReplyInThread) {
            menuItems.push(threadTooltipButton);
        }
        if (showEdit) {
            menuItems.push(editButton);
        }
        if (showPinOrUnpin) {
            menuItems.push(pinButton);
        }
        if (showCancel) {
            menuItems.push(cancelButton);
        }
        if (showExpandCollapse) {
            menuItems.push(expandButton);
        }
        menuItems.push(optionsButton);
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
