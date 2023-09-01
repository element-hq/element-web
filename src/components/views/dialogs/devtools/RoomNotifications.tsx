/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { NotificationCountType, Room, Thread, ReceiptType } from "matrix-js-sdk/src/matrix";
import React, { useContext } from "react";
import { ReadReceipt } from "matrix-js-sdk/src/models/read-receipt";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { useNotificationState } from "../../../../hooks/useRoomNotificationState";
import { _t, _td } from "../../../../languageHandler";
import { determineUnreadState } from "../../../../RoomNotifs";
import { humanReadableNotificationColor } from "../../../../stores/notifications/NotificationColor";
import { doesRoomOrThreadHaveUnreadMessages } from "../../../../Unread";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";

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

    const { color, count } = determineUnreadState(room);
    const [notificationState] = useNotificationState(room);

    return (
        <BaseTool onBack={onBack}>
            <section>
                <h2>{_t("devtools|room_status")}</h2>
                <ul>
                    <li>
                        {count > 0
                            ? _t(
                                  "devtools|room_unread_status_count",
                                  {
                                      status: humanReadableNotificationColor(color),
                                      count,
                                  },
                                  {
                                      strong: (sub) => <strong>{sub}</strong>,
                                  },
                              )
                            : _t(
                                  "devtools|room_unread_status",
                                  {
                                      status: humanReadableNotificationColor(color),
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
                            cli.isRoomEncrypted(room.roomId!)
                                ? _td("devtools|room_encrypted")
                                : _td("devtools|room_not_encrypted"),
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
