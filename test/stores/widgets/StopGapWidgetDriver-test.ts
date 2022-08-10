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

import { mocked, MockedObject } from "jest-mock";
import { Widget, WidgetKind, WidgetDriver } from "matrix-widget-api";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { StopGapWidgetDriver } from "../../../src/stores/widgets/StopGapWidgetDriver";
import { stubClient } from "../../test-utils";

describe("StopGapWidgetDriver", () => {
    let client: MockedObject<MatrixClient>;
    let driver: WidgetDriver;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.get());

        driver = new StopGapWidgetDriver(
            [],
            new Widget({
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org",
            }),
            WidgetKind.Room,
        );
    });

    describe("sendToDevice", () => {
        const contentMap = {
            "@alice:example.org": {
                "*": {
                    hello: "alice",
                },
            },
            "@bob:example.org": {
                "bobDesktop": {
                    hello: "bob",
                },
            },
        };

        it("sends unencrypted messages", async () => {
            await driver.sendToDevice("org.example.foo", false, contentMap);
            expect(client.queueToDevice.mock.calls).toMatchSnapshot();
        });

        it("sends encrypted messages", async () => {
            const aliceWeb = new DeviceInfo("aliceWeb");
            const aliceMobile = new DeviceInfo("aliceMobile");
            const bobDesktop = new DeviceInfo("bobDesktop");

            mocked(client.crypto.deviceList).downloadKeys.mockResolvedValue({
                "@alice:example.org": { aliceWeb, aliceMobile },
                "@bob:example.org": { bobDesktop },
            });

            await driver.sendToDevice("org.example.foo", true, contentMap);
            expect(client.encryptAndSendToDevices.mock.calls).toMatchSnapshot();
        });
    });
});
