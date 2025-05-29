/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { IntegrationManagers } from "../../../src/integrations/IntegrationManagers";
import { stubClient } from "../../test-utils";

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
