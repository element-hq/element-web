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

import React from "react";
import { render } from "@testing-library/react";
import { jest } from "@jest/globals";
import { Room } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../test-utils";
import ContentMessages from "../../../src/ContentMessages";
import { RoomUpload } from "../../../src/models/RoomUpload";
import UploadBar from "../../../src/components/structures/UploadBar";

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
