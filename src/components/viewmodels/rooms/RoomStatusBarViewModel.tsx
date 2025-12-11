/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    ClientEvent,
    EventStatus,
    type MatrixError,
    type Room,
    RoomEvent,
    SyncState,
    type SyncStateData,
} from "matrix-js-sdk/src/matrix";
import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import { _t, _td } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import Resend from "../../../Resend";
import { messageForResourceLimitError } from "../../../utils/ErrorUtils";
import ExternalLink from "../../views/elements/ExternalLink";

interface RoomStatusBarInvisible {
    visible: false;
}

interface RoomStatusBarWithError {
    visible: true;
    connectivityLost: boolean;
}

interface RoomStatusBarWithUnsentMessages {
    visible: true;
    title: ReactNode;
    description?: string;
}

interface RoomStatusBarWithUnsentMessagesActions extends RoomStatusBarWithUnsentMessages {
    isResending: false;
    // callback for when the user clicks on the 'resend all' button in the
    // 'unsent messages' bar
    onResendAllClick?: () => void;

    // callback for when the user clicks on the 'cancel all' button in the
    // 'unsent messages' bar
    onCancelAllClick?: () => void;
}

interface RoomStatusBarWithUnsentMessagesResending extends RoomStatusBarWithUnsentMessages {
    isResending: true;
}

type RoomStatusBarVM =
    | RoomStatusBarWithError
    | RoomStatusBarWithUnsentMessagesActions
    | RoomStatusBarWithUnsentMessagesResending
    | RoomStatusBarInvisible;

interface IProps {
    // the room this statusbar is representing.
    room: Room;
}

export function useRoomStatusBarViewModel({ room }: IProps): RoomStatusBarVM {
    const client = useMatrixClientContext();
    const syncState = useTypedEventEmitterState(
        client,
        ClientEvent.Sync,
        (state: SyncState, prevState: SyncState, data: SyncStateData) => {
            return { state, data };
        },
    );
    const [isResending, setResending] = useState(false);
    const unsentMessages = useTypedEventEmitterState(room, RoomEvent.LocalEchoUpdated, () => {
        return room.getPendingEvents().filter(function (ev) {
            const isNotSent = ev.status === EventStatus.NOT_SENT;
            return isNotSent;
        });
    });

    const onResendAllClick = useCallback(() => {
        setResending(true);
        Resend.resendUnsentEvents(room).finally(() => {
            setResending(false);
        });
        dis.fire(Action.FocusSendMessageComposer);
    }, [room]);

    const onCancelAllClick = useCallback(() => {
        Resend.cancelUnsentEvents(room);
        dis.fire(Action.FocusSendMessageComposer);
    }, [room]);

    const unsentMessagesTitle = useMemo(() => {
        let consentError: MatrixError | null = null;
        let resourceLimitError: MatrixError | null = null;
        for (const m of unsentMessages) {
            if (!m.error) {
                continue;
            }
            if (m.error.errcode === "M_CONSENT_NOT_GIVEN") {
                consentError = m.error;
                break;
            }
            if (m.error.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
                resourceLimitError = m.error;
                break;
            }
        }
        if (consentError) {
            return _t(
                "room|status_bar|requires_consent_agreement",
                {},
                {
                    consentLink: (sub) => (
                        <ExternalLink href={consentError!.data?.consent_uri} target="_blank" rel="noreferrer noopener">
                            {sub}
                        </ExternalLink>
                    ),
                },
            );
        } else if (resourceLimitError) {
            return messageForResourceLimitError(
                resourceLimitError.data.limit_type,
                resourceLimitError.data.admin_contact,
                {
                    "monthly_active_user": _td("room|status_bar|monthly_user_limit_reached"),
                    "hs_disabled": _td("room|status_bar|homeserver_blocked"),
                    "": _td("room|status_bar|exceeded_resource_limit"),
                },
            );
        } else {
            return _t("room|status_bar|some_messages_not_sent");
        }
    }, [unsentMessages]);

    const hasConnectionError = useMemo(() => {
        // no conn bar trumps the "some not sent" msg since you can't resend without
        // a connection!
        // There's one situation in which we don't show this 'no connection' bar, and that's
        // if it's a resource limit exceeded error: those are shown in the top bar.
        const errorIsMauError = Boolean(
            syncState.data && syncState.data.error && syncState.data.error.name === "M_RESOURCE_LIMIT_EXCEEDED",
        );
        return syncState.state === SyncState.Error && !errorIsMauError;
    }, [syncState]);

    if (hasConnectionError) {
        return { visible: true, connectivityLost: true };
    }

    if (unsentMessages.length) {
        if (isResending) {
            return {
                visible: true,
                title: unsentMessagesTitle,
                description: _t("room|status_bar|select_messages_to_retry"),
                isResending: true,
            };
        }
        return {
            visible: true,
            title: unsentMessagesTitle,
            description: _t("room|status_bar|select_messages_to_retry"),
            isResending,
            onResendAllClick,
            onCancelAllClick,
        };
    }

    return { visible: false };
}
