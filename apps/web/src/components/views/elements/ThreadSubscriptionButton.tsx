/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useState } from "react";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Button } from "@vector-im/compound-web";
import { NotificationsIcon, NotificationsOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";

interface Props {
    /** The room the thread belongs to. */
    roomId: string;
    /** The event ID of the thread root. */
    threadId: string;
}

/**
 * Button to follow (subscribe to) or unfollow a thread, as defined by MSC4306.
 *
 * Renders nothing unless the `feature_msc4306_thread_subscriptions` labs flag is enabled
 * (which also requires server support), or while the subscription state is unknown.
 */
export function ThreadSubscriptionButton({ roomId, threadId }: Props): JSX.Element | null {
    const client = useMatrixClientContext();
    const enabled = useFeatureEnabled("feature_msc4306_thread_subscriptions");
    const [subscribed, setSubscribed] = useState<boolean | undefined>(() =>
        enabled ? client.getCachedThreadSubscription(roomId, threadId) : undefined,
    );
    const [busy, setBusy] = useState(false);

    // The client cache is updated by our own requests, but also by subscribe-on-send and
    // subscribe-on-mention, so it is the single source of truth for the button state.
    useTypedEventEmitter(
        client,
        ClientEvent.ThreadSubscriptionUpdate,
        (updatedRoomId: string, updatedThreadId: string, isSubscribed: boolean) => {
            if (updatedRoomId === roomId && updatedThreadId === threadId) setSubscribed(isSubscribed);
        },
    );

    useEffect(() => {
        if (!enabled) return;
        setSubscribed(client.getCachedThreadSubscription(roomId, threadId));
        // Refresh from the server: another device may have changed the subscription.
        client.getThreadSubscription(roomId, threadId).catch((e) => {
            logger.warn("MSC4306: failed to fetch thread subscription", e);
        });
    }, [client, enabled, roomId, threadId]);

    const onClick = useCallback(async (): Promise<void> => {
        setBusy(true);
        try {
            if (subscribed) {
                await client.unsubscribeFromThread(roomId, threadId);
            } else {
                await client.subscribeToThread(roomId, threadId);
            }
        } catch (e) {
            logger.warn("MSC4306: failed to update thread subscription", e);
        } finally {
            setBusy(false);
        }
    }, [client, roomId, threadId, subscribed]);

    if (!enabled || subscribed === undefined) return null;

    return (
        <Button
            kind="tertiary"
            size="md"
            Icon={subscribed ? NotificationsIcon : NotificationsOffIcon}
            onClick={onClick}
            disabled={busy}
            data-testid="thread-subscription-button"
        >
            {subscribed ? _t("threads|subscribed") : _t("threads|subscribe")}
        </Button>
    );
}
