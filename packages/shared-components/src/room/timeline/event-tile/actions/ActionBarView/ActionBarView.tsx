/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import {
    CollapseIcon,
    DeleteIcon,
    EditIcon,
    ExpandIcon,
    InlineCodeIcon,
    LinkIcon,
    PinIcon,
    ReplyIcon,
    RestartIcon,
    UnpinIcon,
    ThreadsIcon,
    VisibilityOnIcon,
    VisibilityOffIcon,
    DownloadIcon,
    OverflowHorizontalIcon,
    ReactionAddIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner } from "@vector-im/compound-web";

import { useI18n } from "../../../../../core/i18n/i18nContext";
import { Flex } from "../../../../../core/utils/Flex";
import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { ActionBarButton } from "./ActionBarButton";
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
    /** Whether actions should render as icon buttons or label buttons. */
    presentation?: "icon" | "label";
    /** Whether an in-progress download should be presented as decrypting rather than downloading. */
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
    onCopyLinkClick?: (anchor: HTMLElement | null) => void;
    onDownloadClick?: (anchor: HTMLElement | null) => void;
    onEditClick?: (anchor: HTMLElement | null) => void;
    onHideClick?: (anchor: HTMLElement | null) => void;
    onOptionsClick?: (anchor: HTMLElement | null) => void;
    onPinClick?: (anchor: HTMLElement | null) => void;
    onReactionsClick?: (anchor: HTMLElement | null) => void;
    onRemoveClick?: (anchor: HTMLElement | null) => void;
    onReplyClick?: (anchor: HTMLElement | null) => void;
    onReplyInThreadClick?: (anchor: HTMLElement | null) => void;
    onResendClick?: (anchor: HTMLElement | null) => void;
    onToggleThreadExpanded?: (anchor: HTMLElement | null) => void;
    onViewInRoomClick?: (anchor: HTMLElement | null) => void;
    onViewSourceClick?: (anchor: HTMLElement | null) => void;
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
    CopyLink = "copyLink",
    Download = "download",
    Edit = "edit",
    Expand = "expand",
    Hide = "hide",
    Options = "options",
    Pin = "pin",
    React = "react",
    Remove = "remove",
    Reply = "reply",
    ReplyInThread = "replyInThread",
    Resend = "resend",
    ViewInRoom = "viewInRoom",
    ViewSource = "viewSource",
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
    const copyLinkTriggerRef = useRef<HTMLButtonElement>(null);
    const downloadTriggerRef = useRef<HTMLButtonElement>(null);
    const editTriggerRef = useRef<HTMLButtonElement>(null);
    const expandTriggerRef = useRef<HTMLButtonElement>(null);
    const hideTriggerRef = useRef<HTMLButtonElement>(null);
    const pinTriggerRef = useRef<HTMLButtonElement>(null);
    const reactTriggerRef = useRef<HTMLButtonElement>(null);
    const removeTriggerRef = useRef<HTMLButtonElement>(null);
    const replyTriggerRef = useRef<HTMLButtonElement>(null);
    const replyInThreadTriggerRef = useRef<HTMLButtonElement>(null);
    const resendTriggerRef = useRef<HTMLButtonElement>(null);
    const viewInRoomTriggerRef = useRef<HTMLButtonElement>(null);
    const viewSourceTriggerRef = useRef<HTMLButtonElement>(null);
    const optionsTriggerRef = useRef<HTMLButtonElement>(null);
    const {
        actions,
        presentation = "icon",
        isThreadReplyAllowed,
        isDownloadEncrypted,
        isDownloadLoading,
        isPinned,
        isQuoteExpanded,
    } = useViewModel(vm);

    const actionButtons: Partial<Record<ActionBarAction, JSX.Element>> = {};

    actionButtons[ActionBarAction.Edit] = (
        <ActionBarButton
            key={ActionBarAction.Edit}
            presentation={presentation}
            buttonRef={editTriggerRef}
            label={_t("action|edit")}
            onActivate={vm.onEditClick}
            icon={EditIcon}
        />
    );

    const pinDescription = isPinned ? _t("action|unpin") : _t("action|pin");
    actionButtons[ActionBarAction.Pin] = (
        <ActionBarButton
            key={ActionBarAction.Pin}
            presentation={presentation}
            buttonRef={pinTriggerRef}
            label={pinDescription}
            onActivate={vm.onPinClick}
            icon={isPinned ? UnpinIcon : PinIcon}
            ariaPressed={isPinned}
        />
    );

    actionButtons[ActionBarAction.Cancel] = (
        <ActionBarButton
            key={ActionBarAction.Cancel}
            presentation={presentation}
            buttonRef={cancelTriggerRef}
            label={_t("action|delete")}
            onActivate={vm.onCancelClick}
            icon={DeleteIcon}
        />
    );

    actionButtons[ActionBarAction.CopyLink] = (
        <ActionBarButton
            key={ActionBarAction.CopyLink}
            presentation={presentation}
            buttonRef={copyLinkTriggerRef}
            label={_t("timeline|mab|copy_link_thread")}
            onActivate={vm.onCopyLinkClick}
            icon={LinkIcon}
        />
    );

    actionButtons[ActionBarAction.Reply] = (
        <ActionBarButton
            key={ActionBarAction.Reply}
            presentation={presentation}
            buttonRef={replyTriggerRef}
            label={_t("action|reply")}
            onActivate={vm.onReplyClick}
            icon={ReplyIcon}
        />
    );

    actionButtons[ActionBarAction.React] = (
        <ActionBarButton
            key={ActionBarAction.React}
            presentation={presentation}
            buttonRef={reactTriggerRef}
            label={_t("action|react")}
            onActivate={vm.onReactionsClick}
            icon={ReactionAddIcon}
        />
    );

    let downloadTitle = _t("action|download");
    if (isDownloadLoading) {
        downloadTitle = isDownloadEncrypted
            ? _t("timeline|download_action_decrypting")
            : _t("timeline|download_action_downloading");
    }
    actionButtons[ActionBarAction.Download] = (
        <ActionBarButton
            key={ActionBarAction.Download}
            presentation={presentation}
            buttonRef={downloadTriggerRef}
            label={downloadTitle}
            onActivate={vm.onDownloadClick}
            icon={isDownloadLoading ? InlineSpinner : DownloadIcon}
            disabled={isDownloadLoading}
        />
    );

    actionButtons[ActionBarAction.Hide] = (
        <ActionBarButton
            key={ActionBarAction.Hide}
            presentation={presentation}
            buttonRef={hideTriggerRef}
            label={_t("action|hide")}
            onActivate={vm.onHideClick}
            icon={VisibilityOffIcon}
        />
    );

    const threadTooltipDescription = isThreadReplyAllowed
        ? _t("action|reply_in_thread")
        : _t("threads|error_start_thread_existing_relation");
    actionButtons[ActionBarAction.ReplyInThread] = (
        <ActionBarButton
            key={ActionBarAction.ReplyInThread}
            presentation={presentation}
            buttonRef={replyInThreadTriggerRef}
            label={_t("action|reply_in_thread")}
            tooltipDescription={threadTooltipDescription}
            onActivate={vm.onReplyInThreadClick}
            icon={ThreadsIcon}
            disabled={!isThreadReplyAllowed}
        />
    );

    actionButtons[ActionBarAction.Resend] = (
        <ActionBarButton
            key={ActionBarAction.Resend}
            presentation={presentation}
            buttonRef={resendTriggerRef}
            label={_t("action|retry")}
            onActivate={vm.onResendClick}
            icon={RestartIcon}
        />
    );

    const expandDescription = isQuoteExpanded
        ? _t("timeline|mab|collapse_reply_chain")
        : _t("timeline|mab|expand_reply_chain");
    actionButtons[ActionBarAction.Expand] = (
        <ActionBarButton
            key={ActionBarAction.Expand}
            presentation={presentation}
            buttonRef={expandTriggerRef}
            label={expandDescription}
            tooltipCaption={`${_t("keyboard|shift")} + ${_t("action|click")}`}
            onActivate={vm.onToggleThreadExpanded}
            icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
            ariaExpanded={isQuoteExpanded}
        />
    );

    actionButtons[ActionBarAction.Options] = (
        <ActionBarButton
            key={ActionBarAction.Options}
            presentation={presentation}
            buttonRef={optionsTriggerRef}
            label={_t("common|options")}
            onActivate={vm.onOptionsClick}
            icon={OverflowHorizontalIcon}
        />
    );

    actionButtons[ActionBarAction.Remove] = (
        <ActionBarButton
            key={ActionBarAction.Remove}
            presentation={presentation}
            buttonRef={removeTriggerRef}
            label={_t("action|remove")}
            onActivate={vm.onRemoveClick}
            icon={DeleteIcon}
        />
    );

    actionButtons[ActionBarAction.ViewInRoom] = (
        <ActionBarButton
            key={ActionBarAction.ViewInRoom}
            presentation={presentation}
            buttonRef={viewInRoomTriggerRef}
            label={_t("timeline|mab|view_in_room")}
            onActivate={vm.onViewInRoomClick}
            icon={VisibilityOnIcon}
        />
    );

    actionButtons[ActionBarAction.ViewSource] = (
        <ActionBarButton
            key={ActionBarAction.ViewSource}
            presentation={presentation}
            buttonRef={viewSourceTriggerRef}
            label={_t("action|view_source")}
            onActivate={vm.onViewSourceClick}
            icon={InlineCodeIcon}
        />
    );

    const isActionDisabled = useCallback(
        (action: ActionBarAction): boolean => {
            switch (action) {
                case ActionBarAction.Download:
                    return isDownloadLoading;
                case ActionBarAction.ReplyInThread:
                    return !isThreadReplyAllowed;
                default:
                    return false;
            }
        },
        [isDownloadLoading, isThreadReplyAllowed],
    );

    const toolbarButtons = useMemo<ToolbarButtonMeta[]>(() => {
        return actions.map((action) => ({
            action,
            ref: (() => {
                switch (action) {
                    case ActionBarAction.Cancel:
                        return cancelTriggerRef;
                    case ActionBarAction.CopyLink:
                        return copyLinkTriggerRef;
                    case ActionBarAction.Download:
                        return downloadTriggerRef;
                    case ActionBarAction.Edit:
                        return editTriggerRef;
                    case ActionBarAction.Expand:
                        return expandTriggerRef;
                    case ActionBarAction.Hide:
                        return hideTriggerRef;
                    case ActionBarAction.Options:
                        return optionsTriggerRef;
                    case ActionBarAction.Pin:
                        return pinTriggerRef;
                    case ActionBarAction.React:
                        return reactTriggerRef;
                    case ActionBarAction.Remove:
                        return removeTriggerRef;
                    case ActionBarAction.Reply:
                        return replyTriggerRef;
                    case ActionBarAction.ReplyInThread:
                        return replyInThreadTriggerRef;
                    case ActionBarAction.Resend:
                        return resendTriggerRef;
                    case ActionBarAction.ViewInRoom:
                        return viewInRoomTriggerRef;
                    case ActionBarAction.ViewSource:
                        return viewSourceTriggerRef;
                }
            })(),
            disabled: isActionDisabled(action),
        }));
    }, [actions, isActionDisabled]);

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

    // aria-live=off to not have this read out automatically as navigating around timeline, gets repetitive.
    return (
        <Flex
            display="inline-flex"
            direction="row"
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
