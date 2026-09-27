/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";
import { render, within } from "test-utils-rtl";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import { mkEvent, stubClient, mkMessage } from "test-utils";
import ViewSource from "./ViewSource";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import userEvent from "@testing-library/user-event";

describe("ViewSource", () => {
    const ROOM_ID = "!roomId:example.org";
    const SENDER = "@alice:example.org";

    let redactedMessageEvent: MatrixEvent;

    const redactionEvent = mkEvent({
        user: SENDER,
        event: true,
        type: EventType.RoomRedaction,
        content: {},
    });

    beforeEach(() => {
        redactedMessageEvent = new MatrixEvent({
            type: EventType.RoomMessageEncrypted,
            room_id: ROOM_ID,
            sender: SENDER,
            content: {},
            state_key: undefined,
        });
        redactedMessageEvent.makeRedacted(redactionEvent, new Room(ROOM_ID, stubClient(), SENDER));
    });

    beforeEach(stubClient);

    it("should render", () => {
        const event = mkMessage({
            msg: "hello",
            user: SENDER,
            room: ROOM_ID,
            event: true,
            id: "$event1:example.org",
        });
        const { asFragment } = render(<ViewSource mxEvent={event} onFinished={() => {}} />);
        expect(asFragment()).toMatchSnapshot();
    });

    // See https://github.com/vector-im/element-web/issues/24165
    it("doesn't error when viewing redacted encrypted messages", () => {
        // Sanity checks
        expect(redactedMessageEvent.isEncrypted()).toBeTruthy();
        // @ts-ignore clearEvent is private, but it's being used directly <ViewSource />
        expect(redactedMessageEvent.clearEvent).toBe(undefined);

        expect(() => render(<ViewSource mxEvent={redactedMessageEvent} onFinished={() => {}} />)).not.toThrow();
    });

    it("shows full event envelope in decrypted source for own-device events", () => {
        // Simulate an encrypted event whose clearEvent only has type+content,
        // the shape produced for events sent from the current device.
        const encryptedEvent = new MatrixEvent({
            type: EventType.RoomMessageEncrypted,
            room_id: ROOM_ID,
            sender: SENDER,
            event_id: "$enc1:example.org",
            origin_server_ts: 1000,
            content: { algorithm: "m.megolm.v1.aes-sha2" },
        });
        // @ts-ignore clearEvent is private
        encryptedEvent.clearEvent = { type: "m.room.message", content: { msgtype: "m.text", body: "secret" } };

        const { getByText } = render(<ViewSource mxEvent={encryptedEvent} onFinished={() => {}} />);

        // Find the open <details> element (the decrypted event source section)
        const decryptedHeading = getByText("Decrypted event source");
        const decryptedSection = decryptedHeading.closest("details")!;

        // Envelope fields from the wire event must be present in the decrypted section
        expect(within(decryptedSection).getByText("$enc1:example.org", { exact: false })).toBeInTheDocument();
        expect(within(decryptedSection).getByText(SENDER, { exact: false })).toBeInTheDocument();
        // Decrypted content must also be present
        expect(within(decryptedSection).getByText("secret", { exact: false })).toBeInTheDocument();
    });

    it("should be able to edit a message", async () => {
        const event = mkMessage({
            msg: "Test",
            user: MatrixClientPeg.get()!.getSafeUserId(),
            room: ROOM_ID,
            event: true,
            id: "$event2:example.org",
        });
        const { getByRole, asFragment } = render(<ViewSource mxEvent={event} onFinished={() => {}} />);
        const editButton = getByRole("button", { name: "Edit" });
        expect(editButton).toBeInTheDocument();
        await userEvent.click(editButton);
        expect(asFragment()).toMatchSnapshot();
    });
});
