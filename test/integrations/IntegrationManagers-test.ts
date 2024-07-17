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

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { IntegrationManagers } from "../../src/integrations/IntegrationManagers";
import { stubClient } from "../test-utils";

describe("IntegrationManagers", () => {
    let client: MatrixClient;
    let intMgrs: IntegrationManagers;

    beforeEach(() => {
        client = stubClient();
        mocked(client).getAccountData.mockReturnValue({
            getContent: jest.fn().mockReturnValue({
                foo: {
                    id: "foo",
                    content: {
                        type: "m.integration_manager",
                        url: "http://foo/ui",
                        data: {
                            api_url: "http://foo/api",
                        },
                    },
                },
                bar: {
                    id: "bar",
                    content: {
                        type: "m.integration_manager",
                        url: "http://bar/ui",
                        data: {
                            api_url: "http://bar/api",
                        },
                    },
                },
            }),
        } as unknown as MatrixEvent);

        intMgrs = new IntegrationManagers();
        intMgrs.startWatching();
    });

    afterEach(() => {
        intMgrs.stopWatching();
    });

    describe("getOrderedManagers", () => {
        it("should return integration managers in alphabetical order", () => {
            const orderedManagers = intMgrs.getOrderedManagers();

            expect(orderedManagers[0].id).toBe("bar");
            expect(orderedManagers[1].id).toBe("foo");
        });
    });
});
