/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import fetchMockJest from "fetch-mock-jest";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { clearAllModals, stubClient } from "../../../../test-utils";
import DownloadActionButton from "../../../../../src/components/views/messages/DownloadActionButton";
import Modal from "../../../../../src/Modal";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";

jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn().mockResolvedValue(new Blob(["TESTFILE"], { type: "application/octet-stream" })),
}));

describe("DownloadActionButton", () => {
    const plainEvent = new MatrixEvent({
        room_id: "!room:id",
        sender: "@user:id",
        type: "m.room.message",
        content: {
            body: "test",
            msgtype: "m.image",
            url: "mxc://matrix.org/1234",
        },
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        fetchMockJest.restore();
    });

    afterEach(() => {
        clearAllModals();
    });

    it("should show error if media API returns one", async () => {
        const cli = stubClient();
        // eslint-disable-next-line no-restricted-properties
        mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/r0/download/${mxc.slice(6)}`,
        );

        fetchMockJest.getOnce("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", {
            status: 404,
            body: { errcode: "M_NOT_FOUND", error: "Not found" },
        });

        const mediaEventHelper = new MediaEventHelper(plainEvent);

        render(<DownloadActionButton mxEvent={plainEvent} mediaEventHelperGet={() => mediaEventHelper} />);

        const spy = jest.spyOn(Modal, "createDialog");

        fireEvent.click(screen.getByRole("button"));
        await waitFor(() =>
            expect(spy).toHaveBeenCalledWith(
                ErrorDialog,
                expect.objectContaining({
                    title: "Download failed",
                }),
            ),
        );
    });

    it("should show download tooltip on hover", async () => {
        stubClient();

        const user = userEvent.setup();

        fetchMockJest.getOnce("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", "TESTFILE");

        const event = new MatrixEvent({
            room_id: "!room:id",
            sender: "@user:id",
            type: "m.room.message",
            content: {
                body: "test",
                msgtype: "m.image",
                url: "mxc://matrix.org/1234",
            },
        });

        render(<DownloadActionButton mxEvent={event} mediaEventHelperGet={() => undefined} />);

        const button = screen.getByRole("button");
        await user.hover(button);

        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent("Download");
        });
    });

    it("should show downloading tooltip while unencrypted files are downloading", async () => {
        const user = userEvent.setup();

        stubClient();

        fetchMockJest.getOnce("http://this.is.a.url/matrix.org/1234", "TESTFILE");

        const mediaEventHelper = new MediaEventHelper(plainEvent);

        render(<DownloadActionButton mxEvent={plainEvent} mediaEventHelperGet={() => mediaEventHelper} />);

        const button = screen.getByRole("button");
        await user.hover(button);

        await user.click(button);

        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent("Downloading");
        });
    });

    it("should show decrypting tooltip while encrypted files are downloading", async () => {
        const user = userEvent.setup();

        stubClient();

        fetchMockJest.getOnce("http://this.is.a.url/matrix.org/1234", "UFTUGJMF");

        const e2eEvent = new MatrixEvent({
            room_id: "!room:id",
            sender: "@user:id",
            type: "m.room.message",
            content: {
                body: "test",
                msgtype: "m.image",
                file: { url: "mxc://matrix.org/1234" },
            },
        });

        const mediaEventHelper = new MediaEventHelper(e2eEvent);

        render(<DownloadActionButton mxEvent={e2eEvent} mediaEventHelperGet={() => mediaEventHelper} />);

        const button = screen.getByRole("button");
        await user.hover(button);

        await user.click(button);

        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent("Decrypting");
        });
    });
});
