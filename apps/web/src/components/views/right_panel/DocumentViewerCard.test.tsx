/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { EventType, type MatrixClient, MatrixEvent, MsgType, Room } from "matrix-js-sdk/src/matrix";

import { DocumentViewerCard } from "./DocumentViewerCard";
import { clientAndSDKContextRenderOptions, stubClient, TestSDKContext } from "../../../test/test-utils";

function mkFileEvent(): MatrixEvent {
    return new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        event_id: "$readme",
        type: EventType.RoomMessage,
        content: {
            body: "README.md",
            msgtype: MsgType.File,
            url: "mxc://example.org/readme",
            info: { mimetype: "text/markdown" },
        },
    });
}

describe("DocumentViewerCard", () => {
    let client: MatrixClient;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        client = stubClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
    });

    it("names the card after the file and mounts its viewer", async () => {
        render(
            <DocumentViewerCard mxEvent={mkFileEvent()} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(screen.getByRole("heading", { name: "README.md" })).toBeInTheDocument();
        // The viewer is code split, so it shows up once its chunk has loaded.
        expect(await screen.findByRole("status")).toHaveTextContent("Loading document");
    });

    it("shows an error that can be closed when the attachment can no longer be opened", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const mxEvent = mkFileEvent();
        // A redaction while the card is open leaves an event no viewer handles.
        mxEvent.makeRedacted(mxEvent, new Room(mxEvent.getRoomId()!, client, client.getSafeUserId()));

        render(
            <DocumentViewerCard mxEvent={mxEvent} onClose={onClose} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(screen.getByRole("heading", { name: "Document" })).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this file.");

        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
