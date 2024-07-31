/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { mocked } from "jest-mock";
import fetchMockJest from "fetch-mock-jest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../../test-utils";
import DownloadActionButton from "../../../../src/components/views/messages/DownloadActionButton";
import Modal from "../../../../src/Modal";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import ErrorDialog from "../../../../src/components/views/dialogs/ErrorDialog";

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
