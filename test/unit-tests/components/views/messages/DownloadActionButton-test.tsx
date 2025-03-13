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

import { stubClient } from "../../../../test-utils";
import DownloadActionButton from "../../../../../src/components/views/messages/DownloadActionButton";
import Modal from "../../../../../src/Modal";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";

describe("DownloadActionButton", () => {
    it("should show error if media API returns one", async () => {
        const cli = stubClient();
        // eslint-disable-next-line no-restricted-properties
        mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/r0/download/${mxc.slice(6)}`,
        );

        fetchMockJest.get("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", {
            status: 404,
            body: { errcode: "M_NOT_FOUND", error: "Not found" },
        });

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
        const mediaEventHelper = new MediaEventHelper(event);

        render(<DownloadActionButton mxEvent={event} mediaEventHelperGet={() => mediaEventHelper} />);

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
});
