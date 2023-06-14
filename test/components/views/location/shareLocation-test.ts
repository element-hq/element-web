/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import { LegacyLocationEventContent, MLocationEventContent } from "matrix-js-sdk/src/@types/location";

import { doMaybeLocalRoomAction } from "../../../../src/utils/local-room";
import {
    LocationShareType,
    shareLocation,
    ShareLocationFn,
} from "../../../../src/components/views/location/shareLocation";

jest.mock("../../../../src/utils/local-room", () => ({
    doMaybeLocalRoomAction: jest.fn(),
}));

jest.mock("matrix-js-sdk/src/content-helpers", () => ({
    makeLocationContent: jest.fn(),
}));

describe("shareLocation", () => {
    const roomId = "!room:example.com";
    const shareType = LocationShareType.Pin;
    const content = { test: "location content" } as unknown as LegacyLocationEventContent & MLocationEventContent;
    let client: MatrixClient;
    let shareLocationFn: ShareLocationFn;

    beforeEach(() => {
        client = {
            sendMessage: jest.fn(),
        } as unknown as MatrixClient;

        mocked(makeLocationContent).mockReturnValue(content);
        mocked(doMaybeLocalRoomAction).mockImplementation(
            <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>, client?: MatrixClient) => {
                return fn(roomId);
            },
        );

        shareLocationFn = shareLocation(client, roomId, shareType, undefined, () => {});
    });

    it("should forward the call to doMaybeLocalRoomAction", () => {
        shareLocationFn({ uri: "https://example.com/" });
        expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, content);
    });
});
