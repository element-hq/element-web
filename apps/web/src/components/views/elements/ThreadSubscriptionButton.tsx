/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@vector-im/compound-web";
import {
    NotificationsIcon,
    NotificationsOffIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";

interface Props {
    roomId: string;
    threadId: string;
}

type SubscriptionState = "subscribed" | "unsubscribed" | "loading";

/**
 * Button to subscribe/unsubscribe to a thread using MSC4306.
 */
const ThreadSubscriptionButton: React.FC<Props> = ({ roomId, threadId }) => {
    const [state, setState] = useState<SubscriptionState>("loading");

    const fetchSubscription = useCallback(async (): Promise<void> => {
        const client = MatrixClientPeg.safeGet();
        try {
            const sub = await client.getThreadSubscription(roomId, threadId);
            setState(sub ? "subscribed" : "unsubscribed");
        } catch {
            setState("unsubscribed");
        }
    }, [roomId, threadId]);

    useEffect(() => {
        setState("loading");
        fetchSubscription();
    }, [fetchSubscription]);

    const toggleSubscription = useCallback(async (): Promise<void> => {
        const client = MatrixClientPeg.safeGet();
        const wasSubscribed = state === "subscribed";
        setState(wasSubscribed ? "unsubscribed" : "subscribed");
        try {
            if (wasSubscribed) {
                await client.unsubscribeFromThread(roomId, threadId);
            } else {
                await client.subscribeToThread(roomId, threadId);
            }
        } catch {
            setState(wasSubscribed ? "subscribed" : "unsubscribed");
        }
    }, [roomId, threadId, state]);

    if (state === "loading") {
        return null;
    }

    const isSubscribed = state === "subscribed";
    const label = isSubscribed ? _t("threads|subscribed") : _t("threads|subscribe");

    return (
        <Button
            kind="tertiary"
            size="sm"
            Icon={isSubscribed ? NotificationsIcon : NotificationsOffIcon}
            onClick={toggleSubscription}
            data-testid="thread-subscription-button"
        >
            {label}
        </Button>
    );
};

export default ThreadSubscriptionButton;
