/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 , 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { getNameForEventRoom, userLabelForEventRoom } from "../../../utils/KeyVerificationStateObserver";
import EventTileBubble from "./EventTileBubble";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

interface Props {
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

interface MKeyVerificationRequestContent {
    body?: string;
    format?: string;
    formatted_body?: string;
    from_device: string;
    methods: Array<string>;
    msgtype: "m.key.verification.request";
    to: string;
}

/**
 * Event tile created when we receive an m.key.verification.request event.
 *
 * Displays a simple message saying that a verification was requested, either by
 * this user or someone else.
 *
 * EventTileFactory has logic meaning we only display this tile if the request
 * was sent to/from this user.
 */
const MKeyVerificationRequest: React.FC<Props> = ({ mxEvent, timestamp }) => {
    const client = useMatrixClientContext();

    if (!client) {
        throw new Error("Attempting to render verification request without a client context!");
    }

    const myUserId = client.getSafeUserId();
    const content: MKeyVerificationRequestContent = mxEvent.getContent();
    const sender = mxEvent.getSender();
    const receiver = content.to;
    const roomId = mxEvent.getRoomId();

    if (!sender) {
        throw new Error("Verification request did not include a sender!");
    }
    if (!roomId) {
        throw new Error("Verification request did not include a room ID!");
    }

    let title: string;
    let subtitle: string;

    const sentByMe = sender === myUserId;
    if (sentByMe) {
        title = _t("timeline|m.key.verification.request|you_started");
        subtitle = userLabelForEventRoom(client, receiver, roomId);
    } else {
        const name = getNameForEventRoom(client, sender, roomId);
        title = _t("timeline|m.key.verification.request|user_wants_to_verify", { name });
        subtitle = userLabelForEventRoom(client, sender, roomId);
    }

    return (
        <EventTileBubble
            className="mx_cryptoEvent mx_cryptoEvent_icon"
            title={title}
            subtitle={subtitle}
            timestamp={timestamp}
        >
            <></>
        </EventTileBubble>
    );
};

export default MKeyVerificationRequest;
