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

import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import { Thread } from "matrix-js-sdk/src/models/thread";
import React, { useContext } from "react";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { useNotificationState } from "../../../../hooks/useRoomNotificationState";
import { _t, _td } from "../../../../languageHandler";
import { determineUnreadState } from "../../../../RoomNotifs";
import { humanReadableNotificationColor } from "../../../../stores/notifications/NotificationColor";
import { doesRoomOrThreadHaveUnreadMessages } from "../../../../Unread";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";

export default function RoomNotifications({ onBack }: IDevtoolsProps): JSX.Element {
    const { room } = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const { color, count } = determineUnreadState(room);
    const [notificationState] = useNotificationState(room);

    return (
        <BaseTool onBack={onBack}>
            <section>
                <h2>{_t("Room status")}</h2>
                <ul>
                    <li>
                        {_t(
                            "Room unread status: <strong>%(status)s</strong>, count: <strong>%(count)s</strong>",
                            {
                                status: humanReadableNotificationColor(color),
                                count,
                            },
                            {
                                strong: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </li>
                    <li>
                        {_t(
                            "Notification state is <strong>%(notificationState)s</strong>",
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
                                ? _td("Room is <strong>encrypted ✅</strong>")
                                : _td("Room is <strong>not encrypted 🚨</strong>"),
                            {},
                            {
                                strong: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </li>
                </ul>
            </section>

            <section>
                <h2>{_t("Main timeline")}</h2>

                <ul>
                    <li>
                        {_t("Total: ")} {room.getRoomUnreadNotificationCount(NotificationCountType.Total)}
                    </li>
                    <li>
                        {_t("Highlight: ")} {room.getRoomUnreadNotificationCount(NotificationCountType.Highlight)}
                    </li>
                    <li>
                        {_t("Dot: ")} {doesRoomOrThreadHaveUnreadMessages(room) + ""}
                    </li>
                    {roomHasUnread(room) && (
                        <>
                            <li>
                                {_t("User read up to: ")}
                                <strong>
                                    {room.getReadReceiptForUserId(cli.getSafeUserId())?.eventId ??
                                        _t("No receipt found")}
                                </strong>
                            </li>
                            <li>
                                {_t("Last event:")}
                                <ul>
                                    <li>
                                        {_t("ID: ")} <strong>{room.timeline[room.timeline.length - 1].getId()}</strong>
                                    </li>
                                    <li>
                                        {_t("Type: ")}{" "}
                                        <strong>{room.timeline[room.timeline.length - 1].getType()}</strong>
                                    </li>
                                    <li>
                                        {_t("Sender: ")}{" "}
                                        <strong>{room.timeline[room.timeline.length - 1].getSender()}</strong>
                                    </li>
                                </ul>
                            </li>
                        </>
                    )}
                </ul>
            </section>

            <section>
                <h2>{_t("Threads timeline")}</h2>
                <ul>
                    {room
                        .getThreads()
                        .filter((thread) => threadHasUnread(thread))
                        .map((thread) => (
                            <li key={thread.id}>
                                {_t("Thread Id: ")} {thread.id}
                                <ul>
                                    <li>
                                        {_t("Total: ")}
                                        <strong>
                                            {room.getThreadUnreadNotificationCount(
                                                thread.id,
                                                NotificationCountType.Total,
                                            )}
                                        </strong>
                                    </li>
                                    <li>
                                        {_t("Highlight: ")}
                                        <strong>
                                            {room.getThreadUnreadNotificationCount(
                                                thread.id,
                                                NotificationCountType.Highlight,
                                            )}
                                        </strong>
                                    </li>
                                    <li>
                                        {_t("Dot: ")} <strong>{doesRoomOrThreadHaveUnreadMessages(thread) + ""}</strong>
                                    </li>
                                    <li>
                                        {_t("User read up to: ")}
                                        <strong>
                                            {thread.getReadReceiptForUserId(cli.getSafeUserId())?.eventId ??
                                                _t("No receipt found")}
                                        </strong>
                                    </li>
                                    <li>
                                        {_t("Last event:")}
                                        <ul>
                                            <li>
                                                {_t("ID: ")} <strong>{thread.lastReply()?.getId()}</strong>
                                            </li>
                                            <li>
                                                {_t("Type: ")} <strong>{thread.lastReply()?.getType()}</strong>
                                            </li>
                                            <li>
                                                {_t("Sender: ")} <strong>{thread.lastReply()?.getSender()}</strong>
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
