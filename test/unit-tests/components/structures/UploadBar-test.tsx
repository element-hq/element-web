/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { Room } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../../test-utils";
import ContentMessages from "../../../../src/ContentMessages";
import { RoomUpload } from "../../../../src/models/RoomUpload";
import UploadBar from "../../../../src/components/structures/UploadBar";

describe("UploadBar", () => {
    const client = stubClient();
    const room = new Room("!room;server", client, client.getSafeUserId());

    it("should pluralise 5 files correctly", () => {
        jest.spyOn(ContentMessages.sharedInstance(), "getCurrentUploads").mockReturnValue([
            new RoomUpload(room.roomId, "file1.jpg", undefined, 420),
            new RoomUpload(room.roomId, "file2"),
            new RoomUpload(room.roomId, "file3"),
            new RoomUpload(room.roomId, "file4"),
            new RoomUpload(room.roomId, "file5"),
        ]);

        const { getByText } = render(<UploadBar room={room} />);
        expect(getByText("Uploading file1.jpg and 4 others (420 B)")).toBeInTheDocument();
    });

    it("should render a single upload correctly", () => {
        jest.spyOn(ContentMessages.sharedInstance(), "getCurrentUploads").mockReturnValue([
            new RoomUpload(room.roomId, "file1.zip", undefined, 420000000),
        ]);

        const { getByText } = render(<UploadBar room={room} />);
        expect(getByText("Uploading file1.zip (400.54 MB)")).toBeInTheDocument();
    });
});
