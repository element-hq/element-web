/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";
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
 * The snapshot carries the resolved actions to render plus the small amount of
 * per-action state the view needs for labels, icons, and disabled state.
 */
export interface ActionBarViewSnapshot {
    /** Explicitly resolved actions to render, in order. */
    actions: ActionBarAction[];
    /** Whether the current download is for encrypted media. */
    isDownloadEncrypted: boolean;
    /** Whether a media download or decryption is currently in progress. */
    isDownloadLoading: boolean;
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

/**
 * Resolved actions that `ActionBarView` can render.
 *
 * The order of actions in `ActionBarViewSnapshot.actions` defines the visual
 * order of buttons in the toolbar.
 */
export enum ActionBarAction {
    Cancel = "cancel",
    Download = "download",
    Edit = "edit",
    Expand = "expand",
    Hide = "hide",
    Options = "options",
    Pin = "pin",
    React = "react",
    Reply = "reply",
    ReplyInThread = "replyInThread",
    Resend = "resend",
}

interface ToolbarButtonMeta {
    action: ActionBarAction;
    ref: React.RefObject<HTMLButtonElement | null>;
    disabled?: boolean;
}

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
    const [activeIndex, setActiveIndex] = useState(0);
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
        actions,
        isThreadReplyAllowed,
        isDownloadEncrypted,
        isDownloadLoading,
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

    const actionButtons: Partial<Record<ActionBarAction, JSX.Element>> = {};

    actionButtons[ActionBarAction.Edit] = (
        <Tooltip description={_t("action|edit")} placement="top" key="edit">
            <Button
                key={ActionBarAction.Edit}
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
    actionButtons[ActionBarAction.Pin] = (
        <Tooltip description={pinDescription} placement="top" key="pin">
            <Button
                key={ActionBarAction.Pin}
                ref={pinTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={pinDescription}
                aria-pressed={isPinned}
                onClick={() => vm.onPinClick?.(pinTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onPinClick, pinTriggerRef)}
                className={styles.toolbar_item}
                Icon={isPinned ? UnpinIcon : PinIcon}
            />
        </Tooltip>
    );

    actionButtons[ActionBarAction.Cancel] = (
        <Tooltip description={_t("action|delete")} placement="top" key="cancel">
            <Button
                key={ActionBarAction.Cancel}
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

    actionButtons[ActionBarAction.Reply] = (
        <Tooltip description={_t("action|reply")} placement="top" key="reply">
            <Button
                key={ActionBarAction.Reply}
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

    actionButtons[ActionBarAction.React] = (
        <Tooltip description={_t("action|react")} placement="top" key="react">
            <Button
                key={ActionBarAction.React}
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
    actionButtons[ActionBarAction.Download] = (
        <Tooltip description={downloadTitle} placement="top" key="download">
            <Button
                key={ActionBarAction.Download}
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

    actionButtons[ActionBarAction.Hide] = (
        <Tooltip description={_t("action|hide")} placement="top" key="hide">
            <Button
                key={ActionBarAction.Hide}
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
    actionButtons[ActionBarAction.ReplyInThread] = (
        <Tooltip description={threadTooltipDescription} placement="top" key="reply_thread">
            <Button
                key={ActionBarAction.ReplyInThread}
                ref={replyInThreadTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={_t("action|reply_in_thread")}
                disabled={!isThreadReplyAllowed}
                onClick={() => vm.onReplyInThreadClick?.(replyInThreadTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onReplyInThreadClick, replyInThreadTriggerRef)}
                className={styles.toolbar_item}
                Icon={ThreadsIcon}
            />
        </Tooltip>
    );

    actionButtons[ActionBarAction.Resend] = (
        <Tooltip description={_t("action|retry")} placement="top" key="resend">
            <Button
                key={ActionBarAction.Resend}
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
    actionButtons[ActionBarAction.Expand] = (
        <Tooltip
            description={expandDescription}
            caption={`${_t("keyboard|shift")} + ${_t("action|click")}`}
            placement="top"
            key="expand"
        >
            <Button
                key={ActionBarAction.Expand}
                ref={expandTriggerRef}
                kind="tertiary"
                size="sm"
                iconOnly={true}
                aria-label={expandDescription}
                aria-expanded={isQuoteExpanded}
                onClick={() => vm.onToggleThreadExpanded?.(expandTriggerRef.current)}
                onContextMenu={handleContextMenu(vm.onToggleThreadExpanded, expandTriggerRef)}
                className={styles.toolbar_item}
                Icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
            />
        </Tooltip>
    );

    actionButtons[ActionBarAction.Options] = (
        <Tooltip description={_t("common|options")} placement="top" key="options">
            <Button
                key={ActionBarAction.Options}
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

    const toolbarButtons = useMemo<ToolbarButtonMeta[]>(() => {
        return actions.map((action) => ({
            action,
            ref:
                action === ActionBarAction.Cancel
                    ? cancelTriggerRef
                    : action === ActionBarAction.Download
                      ? downloadTriggerRef
                      : action === ActionBarAction.Edit
                        ? editTriggerRef
                        : action === ActionBarAction.Expand
                          ? expandTriggerRef
                          : action === ActionBarAction.Hide
                            ? hideTriggerRef
                            : action === ActionBarAction.Options
                              ? optionsTriggerRef
                              : action === ActionBarAction.Pin
                                ? pinTriggerRef
                                : action === ActionBarAction.React
                                  ? reactTriggerRef
                                  : action === ActionBarAction.Reply
                                    ? replyTriggerRef
                                    : action === ActionBarAction.ReplyInThread
                                      ? replyInThreadTriggerRef
                                      : resendTriggerRef,
            disabled:
                action === ActionBarAction.Download
                    ? isDownloadLoading
                    : action === ActionBarAction.ReplyInThread
                      ? !isThreadReplyAllowed
                      : false,
        }));
    }, [isDownloadLoading, isThreadReplyAllowed, actions]);

    // Handle RovingIndex for toolbar
    const enabledIndices = toolbarButtons
        .map((item, index) => (item.disabled ? -1 : index))
        .filter((index) => index >= 0);
    const fallbackIndex = enabledIndices[0] ?? 0;
    const currentIndex =
        toolbarButtons[activeIndex] && !toolbarButtons[activeIndex].disabled ? activeIndex : fallbackIndex;

    useLayoutEffect(() => {
        setActiveIndex(currentIndex);

        toolbarButtons.forEach(({ ref }, index) => {
            if (ref.current) {
                ref.current.tabIndex = index === currentIndex ? 0 : -1;
            }
        });
    }, [currentIndex, toolbarButtons]);

    const focusButtonAtIndex = (index: number): void => {
        const button = toolbarButtons[index]?.ref.current;
        if (!button) {
            return;
        }

        setActiveIndex(index);
        button.focus();
    };

    const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (enabledIndices.length === 0) {
            return;
        }

        const focusedIndex = toolbarButtons.findIndex(({ ref }) => ref.current === document.activeElement);
        const startIndex = focusedIndex >= 0 ? focusedIndex : currentIndex;

        switch (event.key) {
            case "ArrowRight": {
                event.preventDefault();
                const nextIndex = enabledIndices.find((index) => index > startIndex) ?? enabledIndices[0];
                focusButtonAtIndex(nextIndex);
                break;
            }
            case "ArrowLeft": {
                event.preventDefault();
                const previousIndex = [...enabledIndices].reverse().find((index) => index < startIndex);
                focusButtonAtIndex(previousIndex ?? enabledIndices[enabledIndices.length - 1]);
                break;
            }
            case "Home":
                event.preventDefault();
                focusButtonAtIndex(enabledIndices[0]);
                break;
            case "End":
                event.preventDefault();
                focusButtonAtIndex(enabledIndices[enabledIndices.length - 1]);
                break;
        }
    };

    const handleToolbarFocusCapture = (): void => {
        const focusedIndex = toolbarButtons.findIndex(({ ref }) => ref.current === document.activeElement);
        if (focusedIndex >= 0 && focusedIndex !== activeIndex) {
            setActiveIndex(focusedIndex);
        }
    };

    if (toolbarButtons.length === 0) {
        return null;
    }

    return (
        <Flex
            role="toolbar"
            aria-label={_t("timeline|mab|label")}
            aria-live="off"
            onKeyDown={handleToolbarKeyDown}
            onFocusCapture={handleToolbarFocusCapture}
            className={classNames(className, styles.toolbar)}
        >
            {toolbarButtons.map((meta) => actionButtons[meta.action])}
        </Flex>
    );
}
