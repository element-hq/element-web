/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
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
     * The side of the trigger on which to place the menu. Note that the menu may
     * still end up on a different side than the one you request if there isn't
     * enough space.
     * @default bottom
     */
    side?: "top" | "right" | "bottom" | "left";
    /**
     * The edge along which the menu and trigger will be aligned.
     * @default center
     */
    align?: "start" | "center" | "end";
    canEdit: boolean;
    canPinOrUnpin: boolean;
    isPinned: boolean;
    allowCancel: boolean;
    isFailed: boolean;
    isContentActionable: boolean;
    canSendMessages: boolean;
    canReact: boolean;
    hasThreadRelation: boolean;
    isDownloadEncrypted: boolean;
    isDownloadLoading: boolean;
    showReplyInThreadAction: boolean;
    showThreadForDeletedMessage: boolean;
    showDownloadAction: boolean;
    showHideAction: boolean;
    showExpandCollapseAction: boolean;
    isQuoteExpanded: boolean;
}

export interface ActionBarViewActions {
    onEditClick?: () => void;
    onPinClick?: () => void;
    onResendClick?: () => void;
    onCancelClick?: () => void;
    onDownloadClick?: () => void;
    onHideClick?: () => void;
    onReplyClick?: () => void;
    onReplyInThreadClick?: () => void;
    onToggleThreadExpanded?: () => void;
}

export type ActionBarViewModel = ViewModel<ActionBarViewSnapshot, ActionBarViewActions>;

interface ActionBarViewProps {
    /** The view model for the component. */
    vm: ActionBarViewModel;
    /** Optional CSS class names to apply to the component container.*/
    className?: string;
    /** Whether the menu is open (controlled by the parent). */
    open: boolean;
    /** The element used as the view trigger. */
    trigger: React.ReactNode;
    /** Called when the view requests an open state change. */
    onOpenChange?: (open: boolean) => void;
}

export function ActionBarView({
    vm,
    className,
    open,
    trigger,
    onOpenChange,
}: Readonly<ActionBarViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        side,
        align,
        canEdit,
        canPinOrUnpin,
        isPinned,
        allowCancel,
        isFailed,
        isContentActionable,
        canSendMessages,
        canReact,
        hasThreadRelation,
        isDownloadEncrypted,
        isDownloadLoading,
        showReplyInThreadAction,
        showThreadForDeletedMessage,
        showDownloadAction,
        showHideAction,
        showExpandCollapseAction,
        isQuoteExpanded,
    } = useViewModel(vm);

    const menuItems: JSX.Element[] = [];

    if (canEdit) {
        menuItems.push(
            <Tooltip description={_t("action|edit")} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={_t("action|edit")}
                    onSelect={() => vm.onEditClick?.()}
                    key="edit"
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={EditIcon}
                />
            </Tooltip>,
        );
    }

    if (canPinOrUnpin) {
        const description = isPinned ? _t("action|unpin") : _t("action|pin");
        menuItems.push(
            <Tooltip description={description} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={description}
                    onSelect={() => vm.onPinClick?.()}
                    key="pin"
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={isPinned ? UnpinIcon : PinIcon}
                />
            </Tooltip>,
        );
    }

    const cancelSendingButton = (
        <Tooltip description={_t("action|delete")} placement="top">
            <MenuItem
                as="div"
                label={null}
                aria-label={_t("action|delete")}
                onSelect={() => vm.onCancelClick?.()}
                key="cancel"
                hideChevron={true}
                className={styles.menu_item}
                Icon={DeleteIcon}
            />
        </Tooltip>
    );

    const threadTooltipDescription = hasThreadRelation
        ? _t("action|reply_in_thread")
        : _t("threads|error_start_thread_existing_relation");
    const threadTooltipButton = (
        <Tooltip description={threadTooltipDescription} placement="top">
            <MenuItem
                as="div"
                label={null}
                aria-label={threadTooltipDescription}
                onSelect={hasThreadRelation && vm.onReplyInThreadClick ? vm.onReplyInThreadClick : null}
                key="reply_thread"
                hideChevron={true}
                className={styles.menu_item}
                Icon={ThreadsIcon}
            />
        </Tooltip>
    );

    if (allowCancel && isFailed) {
        menuItems.splice(
            0,
            0,
            <Tooltip description={_t("action|retry")} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={_t("action|retry")}
                    onSelect={() => vm.onResendClick?.()}
                    key="resend"
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={RestartIcon}
                />
            </Tooltip>,
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
                    <Tooltip description={_t("action|reply")} placement="top">
                        <MenuItem
                            as="div"
                            label={null}
                            aria-label={_t("action|reply")}
                            onSelect={() => vm.onReplyClick?.()}
                            key="reply"
                            hideChevron={true}
                            className={styles.menu_item}
                            Icon={ReplyIcon}
                        />
                    </Tooltip>,
                );
            }

            if (canReact) {
                menuItems.splice(
                    0,
                    0,
                    <Tooltip description={_t("action|react")} placement="top">
                        <MenuItem
                            as="div"
                            label={null}
                            aria-label={_t("action|react")}
                            onSelect={null}
                            key="react"
                            hideChevron={true}
                            className={styles.menu_item}
                            Icon={ReactionAddIcon}
                        />
                    </Tooltip>,
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
                    <Tooltip description={downloadTitle} placement="top">
                        <MenuItem
                            as="div"
                            label={null}
                            aria-label={downloadTitle}
                            onSelect={() => vm.onHideClick?.()}
                            key="download"
                            hideChevron={true}
                            className={styles.menu_item}
                            Icon={isDownloadLoading ? InlineSpinner : DownloadIcon}
                        />
                    </Tooltip>,
                );
            }
            if (showHideAction) {
                menuItems.splice(
                    0,
                    0,
                    <Tooltip description={_t("action|hide")} placement="top">
                        <MenuItem
                            as="div"
                            label={null}
                            aria-label={_t("action|hide")}
                            onSelect={() => vm.onHideClick?.()}
                            key="hide"
                            hideChevron={true}
                            className={styles.menu_item}
                            Icon={VisibilityOffIcon}
                        />
                    </Tooltip>,
                );
            }
        } else if (showThreadForDeletedMessage) {
            menuItems.unshift(threadTooltipButton);
        }

        if (allowCancel) {
            menuItems.push(cancelSendingButton);
        }

        if (showExpandCollapseAction) {
            const description = isQuoteExpanded
                ? _t("timeline|mab|collapse_reply_chain")
                : _t("timeline|mab|expand_reply_chain");

            menuItems.push(
                <Tooltip description={description} placement="top">
                    <MenuItem
                        as="div"
                        //caption={_t(ALTERNATE_KEY_NAME[Key.SHIFT]) + " + " + _t("action|click")}
                        //label={_t("keyboard|shift") + " + " + _t("action|click")}
                        aria-label={description}
                        label={null}
                        onSelect={() => vm.onToggleThreadExpanded?.()}
                        key="expand"
                        hideChevron={true}
                        className={styles.menu_item}
                        Icon={isQuoteExpanded ? CollapseIcon : ExpandIcon}
                    />
                </Tooltip>,
            );
        }

        menuItems.push(
            <Tooltip description={_t("common|options")} placement="top">
                <MenuItem
                    as="div"
                    label={null}
                    aria-label={_t("common|options")}
                    onSelect={null}
                    key="options"
                    hideChevron={true}
                    className={styles.menu_item}
                    Icon={OverflowHorizontalIcon}
                />
            </Tooltip>,
        );
    }

    return (
        <Menu
            side={side}
            align={align}
            open={open}
            onOpenChange={(newOpen) => {
                onOpenChange?.(newOpen);
            }}
            trigger={trigger}
            title={_t("timeline|mab|label")}
            showTitle={false}
            aria-live="off"
            className={classNames(className, styles.menu)}
        >
            {menuItems}
        </Menu>
    );
}
