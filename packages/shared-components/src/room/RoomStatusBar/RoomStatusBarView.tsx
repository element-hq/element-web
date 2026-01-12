/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useId, type JSX } from "react";
import { RestartIcon, DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, InlineSpinner, Text } from "@vector-im/compound-web";

import styles from "./RoomStatusBarView.module.css";
import { useViewModel } from "../../useViewModel";
import { type ViewModel } from "../../viewmodel";
import { useI18n } from "../../utils/i18nContext";
import { Banner } from "../../composer/Banner";
export interface RoomStatusBarViewActions {
    /**
     * Called when the user clicks on the 'resend all' button in the 'unsent messages' bar.
     */
    onResendAllClick?: () => Promise<void>;

    /**
     * Called when the user clicks on the 'cancel all' button in the 'unsent messages' bar.
     */
    onDeleteAllClick?: () => void;

    /**
     * Called when the user clicks on the 'Retry' button in the 'failed to start chat' bar.
     */
    onRetryRoomCreationClick?: () => void;

    /**
     * Called when the user clicks on the 'Review Terms and Conditions' button.
     */
    onTermsAndConditionsClicked?: () => void;
}

export const RoomStatusBarState = {
    /**
     * Connectivity to the homeserver has been lost. The user can not take any actions
     * until the connection is restored.
     */
    ConnectionLost: "ConnectionLost",
    /**
     * The homeserver has indiciated the user needs to consent to the Terms and Conditions
     * before they can send a message.
     */
    NeedsConsent: "NeedsConsent",
    /**
     * The homeserver has indiciated that messages can not be sent due to a resource limit
     * being reached. The user may use the given admin contact details.
     */
    ResourceLimited: "ResourceLimited",
    /**
     * There are messages stored locally that previously failed to send that the user
     * may now retry or delete.
     */
    UnsentMessages: "UnsentMessages",
    /**
     * There was an error creating a room. The user may retry creation.
     */
    LocalRoomFailed: "LocalRoomFailed",
} as const;

export interface RoomStatusBarNotVisible {
    state: null;
}

export interface RoomStatusBarNoConnection {
    state: "ConnectionLost";
}

export interface RoomStatusBarConsentState {
    state: "NeedsConsent";
    consentUri: string;
}

export interface RoomStatusBarResourceLimitedState {
    state: "ResourceLimited";
    resourceLimit: "monthly_active_user" | "hs_disabled" | string;
    adminContactHref?: string;
}

export interface RoomStatusBarUnsentMessagesState {
    state: "UnsentMessages";
    isResending: boolean;
}
export interface RoomStatusBarLocalRoomError {
    state: "LocalRoomFailed";
}

export type RoomStatusBarViewSnapshot =
    | RoomStatusBarNoConnection
    | RoomStatusBarConsentState
    | RoomStatusBarResourceLimitedState
    | RoomStatusBarUnsentMessagesState
    | RoomStatusBarLocalRoomError
    | RoomStatusBarNotVisible;

/**
 * The view model for RoomStatusBarView.
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
export function RoomStatusBarView({ vm }: Readonly<RoomStatusBarViewProps>): JSX.Element | null {
    const { translate: _t } = useI18n();
    const snapshot = useViewModel(vm);
    const bannerTitleId = useId();

    const deleteAllClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            vm.onDeleteAllClick?.();
        },
        [vm],
    );

    const resendClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            void vm.onResendAllClick?.();
        },
        [vm],
    );

    const retryRoomCreationClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
        (ev) => {
            ev.preventDefault();
            vm.onRetryRoomCreationClick?.();
        },
        [vm],
    );

    const termsAndConditionsClicked = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(() => {
        // Allow the link to go through.
        vm.onTermsAndConditionsClicked?.();
    }, [vm]);

    if (snapshot.state === null) {
        // Nothing to show!
        return null;
    }

    switch (snapshot.state) {
        case RoomStatusBarState.ConnectionLost:
            return (
                <Banner type="critical" role="status" aria-labelledby={bannerTitleId}>
                    <div className={styles.container}>
                        <Text id={bannerTitleId} weight="semibold">
                            {_t("room|status_bar|server_connectivity_lost_title")}
                        </Text>
                        <Text className={styles.description} size="sm">
                            {_t("room|status_bar|server_connectivity_lost_description")}
                        </Text>
                    </div>
                </Banner>
            );
        case RoomStatusBarState.NeedsConsent:
            return (
                <Banner
                    type="critical"
                    role="status"
                    aria-labelledby={bannerTitleId}
                    actions={
                        <Button
                            onClick={termsAndConditionsClicked}
                            kind="secondary"
                            size="sm"
                            as="a"
                            href={snapshot.consentUri}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {_t("terms|tac_button")}
                        </Button>
                    }
                >
                    <div className={styles.container}>
                        <Text id={bannerTitleId} weight="semibold">
                            {_t("room|status_bar|requires_consent_agreement_title")}
                        </Text>
                    </div>
                </Banner>
            );
        case RoomStatusBarState.ResourceLimited:
            return (
                <Banner
                    type="critical"
                    role="status"
                    aria-labelledby={bannerTitleId}
                    actions={
                        snapshot.adminContactHref && (
                            <Button
                                kind="secondary"
                                size="sm"
                                as="a"
                                href={snapshot.adminContactHref}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                Contact admin
                            </Button>
                        )
                    }
                >
                    <div className={styles.container}>
                        <Text id={bannerTitleId} weight="semibold">
                            {{
                                monthly_active_user: _t("room|status_bar|monthly_user_limit_reached_title"),
                                hs_disabled: _t("room|status_bar|homeserver_blocked_title"),
                            }[snapshot.resourceLimit] || _t("room|status_bar|exceeded_resource_limit_title")}
                        </Text>
                        <Text className={styles.description} size="sm">
                            {_t("room|status_bar|exceeded_resource_limit_description")}
                        </Text>
                    </div>
                </Banner>
            );
        case RoomStatusBarState.LocalRoomFailed:
            return (
                <Banner
                    role="status"
                    type="critical"
                    aria-labelledby={bannerTitleId}
                    actions={
                        <Button
                            size="sm"
                            kind="secondary"
                            className={styles.container}
                            Icon={RestartIcon}
                            onClick={retryRoomCreationClick}
                        >
                            {_t("action|retry")}
                        </Button>
                    }
                >
                    <Text id={bannerTitleId} weight="semibold" className={styles.container}>
                        {_t("room|status_bar|failed_to_create_room_title")}
                    </Text>
                </Banner>
            );
        case RoomStatusBarState.UnsentMessages:
            return (
                <Banner
                    role="status"
                    type="critical"
                    actions={
                        snapshot.isResending ? (
                            <InlineSpinner />
                        ) : (
                            <>
                                {vm.onDeleteAllClick && (
                                    <Button
                                        size="sm"
                                        kind="destructive"
                                        Icon={DeleteIcon}
                                        disabled={snapshot.isResending}
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
                                        disabled={snapshot.isResending}
                                        onClick={resendClick}
                                        className={styles.container}
                                    >
                                        {_t("room|status_bar|retry_all")}
                                    </Button>
                                )}
                            </>
                        )
                    }
                    aria-labelledby={bannerTitleId}
                >
                    <div className={styles.container}>
                        <Text id={bannerTitleId} weight="semibold">
                            {_t("room|status_bar|some_messages_not_sent")}
                        </Text>
                        <Text className={styles.description} size="sm">
                            {_t("room|status_bar|select_messages_to_retry")}
                        </Text>
                    </div>
                </Banner>
            );
        default:
            // We should never get into this state.
            return null;
    }
}
