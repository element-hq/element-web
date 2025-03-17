/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { NotificationCountType, type Room, type Thread, ReceiptType } from "matrix-js-sdk/src/matrix";
import React, { useContext } from "react";
import { type ReadReceipt } from "matrix-js-sdk/src/models/read-receipt";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { useNotificationState } from "../../../../hooks/useRoomNotificationState";
import { _t, _td } from "../../../../languageHandler";
import { determineUnreadState } from "../../../../RoomNotifs";
import { humanReadableNotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { doesRoomOrThreadHaveUnreadMessages } from "../../../../Unread";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import { useIsEncrypted } from "../../../../hooks/useIsEncrypted.ts";

function UserReadUpTo({ target }: { target: ReadReceipt<any, any> }): JSX.Element {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getSafeUserId();
    const hasPrivate = !!target.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate);
    return (
        <>
            <li>
                {_t("devtools|user_read_up_to")}
                <strong>{target.getReadReceiptForUserId(userId)?.eventId ?? _t("devtools|no_receipt_found")}</strong>
            </li>
            <li>
                {_t("devtools|user_read_up_to_ignore_synthetic")}
                <strong>
                    {target.getReadReceiptForUserId(userId, true)?.eventId ?? _t("devtools|no_receipt_found")}
                </strong>
            </li>
            {hasPrivate && (
                <>
                    <li>
                        {_t("devtools|user_read_up_to_private")}
                        <strong>
                            {target.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate)?.eventId ??
                                _t("devtools|no_receipt_found")}
                        </strong>
                    </li>
                    <li>
                        {_t("devtools|user_read_up_to_private_ignore_synthetic")}
                        <strong>
                            {target.getReadReceiptForUserId(userId, true, ReceiptType.ReadPrivate)?.eventId ??
                                _t("devtools|no_receipt_found")}
                        </strong>
                    </li>
                </>
            )}
        </>
    );
}

export default function RoomNotifications({ onBack }: IDevtoolsProps): JSX.Element {
    const { room } = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);
    const isRoomEncrypted = useIsEncrypted(cli, room);

    const { level, count } = determineUnreadState(room, undefined, false);
    const [notificationState] = useNotificationState(room);

    return (
        <BaseTool onBack={onBack}>
            <section>
                <h2>{_t("devtools|room_status")}</h2>
                <ul>
                    <li>
                        {_t(
                            "devtools|room_unread_status_count",
                            {
                                status: humanReadableNotificationLevel(level),
                                count,
                            },
                            {
                                strong: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </li>
                    <li>
                        {_t(
                            "devtools|notification_state",
                            {
                                notificationState,
                            },
                            {
                                strong: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </li>
                    <li>
                        {_t(
                            isRoomEncrypted ? _td("devtools|room_encrypted") : _td("devtools|room_not_encrypted"),
                            {},
                            {
                                strong: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </li>
                </ul>
            </section>

            <section>
                <h2>{_t("devtools|main_timeline")}</h2>

                <ul>
                    <li>
                        {_t("devtools|room_notifications_total")}{" "}
                        {room.getRoomUnreadNotificationCount(NotificationCountType.Total)}
                    </li>
                    <li>
                        {_t("devtools|room_notifications_highlight")}{" "}
                        {room.getRoomUnreadNotificationCount(NotificationCountType.Highlight)}
                    </li>
                    <li>
                        {_t("devtools|room_notifications_dot")} {doesRoomOrThreadHaveUnreadMessages(room) + ""}
                    </li>
                    {roomHasUnread(room) && (
                        <>
                            <UserReadUpTo target={room} />
                            <li>
                                {_t("devtools|room_notifications_last_event")}
                                <ul>
                                    <li>
                                        {_t("devtools|id")}{" "}
                                        <strong>{room.timeline[room.timeline.length - 1].getId()}</strong>
                                    </li>
                                    <li>
                                        {_t("devtools|room_notifications_type")}{" "}
                                        <strong>{room.timeline[room.timeline.length - 1].getType()}</strong>
                                    </li>
                                    <li>
                                        {_t("devtools|room_notifications_sender")}{" "}
                                        <strong>{room.timeline[room.timeline.length - 1].getSender()}</strong>
                                    </li>
                                </ul>
                            </li>
                        </>
                    )}
                </ul>
            </section>

            <section>
                <h2>{_t("devtools|threads_timeline")}</h2>
                <ul>
                    {room
                        .getThreads()
                        .filter((thread) => threadHasUnread(thread))
                        .map((thread) => (
                            <li key={thread.id}>
                                {_t("devtools|room_notifications_thread_id")} {thread.id}
                                <ul>
                                    <li>
                                        {_t("devtools|room_notifications_total")}
                                        <strong>
                                            {room.getThreadUnreadNotificationCount(
                                                thread.id,
                                                NotificationCountType.Total,
                                            )}
                                        </strong>
                                    </li>
                                    <li>
                                        {_t("devtools|room_notifications_highlight")}
                                        <strong>
                                            {room.getThreadUnreadNotificationCount(
                                                thread.id,
                                                NotificationCountType.Highlight,
                                            )}
                                        </strong>
                                    </li>
                                    <li>
                                        {_t("devtools|room_notifications_dot")}{" "}
                                        <strong>{doesRoomOrThreadHaveUnreadMessages(thread) + ""}</strong>
                                    </li>
                                    <UserReadUpTo target={thread} />
                                    <li>
                                        {_t("devtools|room_notifications_last_event")}
                                        <ul>
                                            <li>
                                                {_t("devtools|id")} <strong>{thread.lastReply()?.getId()}</strong>
                                            </li>
                                            <li>
                                                {_t("devtools|room_notifications_type")}{" "}
                                                <strong>{thread.lastReply()?.getType()}</strong>
                                            </li>
                                            <li>
                                                {_t("devtools|room_notifications_sender")}{" "}
                                                <strong>{thread.lastReply()?.getSender()}</strong>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        ))}
                </ul>
            </section>
        </BaseTool>
    );
}

function threadHasUnread(thread: Thread): boolean {
    const total = thread.room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Total);
    const highlight = thread.room.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Highlight);
    const dot = doesRoomOrThreadHaveUnreadMessages(thread);

    return total > 0 || highlight > 0 || dot;
}

function roomHasUnread(room: Room): boolean {
    const total = room.getRoomUnreadNotificationCount(NotificationCountType.Total);
    const highlight = room.getRoomUnreadNotificationCount(NotificationCountType.Highlight);
    const dot = doesRoomOrThreadHaveUnreadMessages(room);

    return total > 0 || highlight > 0 || dot;
}
