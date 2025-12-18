/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";

import styles from "./RoomStatusBarView.module.css";
import { useViewModel } from "../../useViewModel";
import { type ViewModel } from "../../viewmodel";
import { RestartIcon, DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { useI18n } from "../../utils/i18nContext";
import { Button, InlineSpinner, Text } from "@vector-im/compound-web";
import { Banner } from "../../composer/Banner";
export interface RoomStatusBarViewActions {
    /**
     * Called when the user clicks on the 'resend all' button in the 'unsent messages' bar.
     */
    onResendAllClick?: () => void;

    /**
     * Called when the user clicks on the 'cancel all' button in the 'unsent messages' bar.
     */
    onDeleteAllClick?: () => void;

    /**
     * For local rooms which haven't been created yet, this will retry creating the room.
     * @returns
     */
    onRetryRoomCreationClick?: () => void;
}

export interface RoomStatusBarNoConnection {
    connectionLost: true;
}

export interface RoomStatusBarConsentState {
    consentUri: string;
}

export interface RoomStatusBarResourceLimitedState {
    resourceLimit: "monthly_active_user" | "hs_disabled" | string;
    adminContactHref?: string;
}

export interface RoomStatusBarUnsentMessagesState {
    isResending: boolean;
}
export interface RoomStatusBarLocalRoomError {
    isRetryingRoomCreation: boolean;
}

export interface RoomStatusBarViewSnapshot {
    state:
        | RoomStatusBarNoConnection
        | RoomStatusBarConsentState
        | RoomStatusBarResourceLimitedState
        | RoomStatusBarUnsentMessagesState
        | RoomStatusBarLocalRoomError
        | null;
}

/**
 * The view model for the banner.
 */
export type RoomStatusBarViewModel = ViewModel<RoomStatusBarViewSnapshot> & RoomStatusBarViewActions;

interface RoomStatusBarViewProps {
    /**
     * The view model for the banner.
     */
    vm: RoomStatusBarViewModel;
}

/**
 * A component to alert to a failure in the context of a room.
 *
 * @example
 * ```tsx
 * <RoomStatusBarView vm={RoomStatusBarViewModel} />
 * ```
 */
export function RoomStatusBarView({ vm }: Readonly<RoomStatusBarViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { state } = useViewModel(vm);

    const deleteAllClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            vm.onDeleteAllClick?.();
        },
        [vm.onDeleteAllClick],
    );

    const resendClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            vm.onResendAllClick?.();
        },
        [vm.onResendAllClick],
    );

    const retryRoomCreationClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            vm.onRetryRoomCreationClick?.();
        },
        [vm.onRetryRoomCreationClick],
    );

    if (state === null) {
        // Nothing to show!
        return <></>;
    }

    if ("connectionLost" in state) {
        return (
            <Banner type="critical">
                <div className={styles.container}>
                    <Text weight="semibold">{_t("room|status_bar|server_connectivity_lost_title")}</Text>
                    <Text className={styles.description}>
                        {_t("room|status_bar|server_connectivity_lost_description")}
                    </Text>
                </div>
            </Banner>
        );
    }

    if ("consentUri" in state) {
        return (
            <Banner
                type="critical"
                actions={
                    <Button
                        kind="secondary"
                        size="sm"
                        as="a"
                        href={state.consentUri}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        View Terms and Conditions
                    </Button>
                }
            >
                <div className={styles.container}>
                    <Text weight="semibold">{_t("room|status_bar|requires_consent_agreement_title")}</Text>
                </div>
            </Banner>
        );
    }

    if ("resourceLimit" in state) {
        const title =
            {
                monthly_active_user: _t("room|status_bar|monthly_user_limit_reached_title"),
                hs_disabled: _t("room|status_bar|homeserver_blocked_title"),
            }[state.resourceLimit] || _t("room|status_bar|exceeded_resource_limit_title");

        return (
            <Banner
                type="critical"
                actions={
                    state.adminContactHref && (
                        <Button
                            kind="secondary"
                            size="sm"
                            as="a"
                            href={state.adminContactHref}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            Contact admin
                        </Button>
                    )
                }
            >
                <div className={styles.container}>
                    <Text weight="semibold">{title}</Text>
                    <Text className={styles.description}>
                        {_t("room|status_bar|exceeded_resource_limit_description")}
                    </Text>
                </div>
            </Banner>
        );
    }

    if ("isRetryingRoomCreation" in state) {
        return (
            <Banner
                type="critical"
                actions={
                    <Button
                        size="sm"
                        kind="secondary"
                        className={styles.container}
                        Icon={RestartIcon}
                        disabled={state.isRetryingRoomCreation}
                        onClick={retryRoomCreationClick}
                    >
                        {_t("action|retry")}
                    </Button>
                }
            >
                <Text weight="semibold" className={styles.container}>{_t("room|status_bar|failed_to_create_room_title")}</Text>
            </Banner>
        );
    }

    const actions = state.isResending ? (
        <InlineSpinner />
    ) : (
        <>
            {vm.onDeleteAllClick && (
                <Button
                    size="sm"
                    kind="destructive"
                    Icon={DeleteIcon}
                    disabled={state.isResending}
                    onClick={deleteAllClick}
                >
                    {_t("room|status_bar|delete_all")}
                </Button>
            )}
            {vm.onResendAllClick && (
                <Button
                    size="sm"
                    kind="secondary"
                    Icon={RestartIcon}
                    disabled={state.isResending}
                    onClick={resendClick}
                    className={styles.container}
                >
                    {_t("room|status_bar|retry_all")}
                </Button>
            )}
        </>
    );

    return (
        <Banner type="critical" actions={actions}>
            <div className={styles.container}>
                <Text weight="semibold">{_t("room|status_bar|some_messages_not_sent")}</Text>
                <Text className={styles.description}>{_t("room|status_bar|select_messages_to_retry")}</Text>
            </div>
        </Banner>
    );
}
