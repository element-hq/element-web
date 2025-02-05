/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type IClientWellKnown, type IServerVersions, type MatrixClient } from "matrix-js-sdk/src/matrix";
import React from "react";
import fetchMock from "fetch-mock-jest";

import LoginWithQRSection from "../../../../../../src/components/views/settings/devices/LoginWithQRSection";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";

function makeClient(wellKnown: IClientWellKnown) {
    const crypto = mocked({
        supportsSecretsForQrLogin: jest.fn().mockReturnValue(true),
        isCrossSigningReady: jest.fn().mockReturnValue(true),
    });

    return mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        getUserId: jest.fn(),
        on: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
        removeListener: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
        getClientWellKnown: jest.fn().mockReturnValue(wellKnown),
        getCrypto: jest.fn().mockReturnValue(crypto),
    } as unknown as MatrixClient);
}

function makeVersions(unstableFeatures: Record<string, boolean>): IServerVersions {
    return {
        versions: [],
        unstable_features: unstableFeatures,
    };
}

describe("<LoginWithQRSection />", () => {
    beforeAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(makeClient({}));
    });

    describe("MSC4108", () => {
        describe("MSC4108", () => {
            const defaultProps = {
                onShowQr: () => {},
                versions: makeVersions({ "org.matrix.msc4108": true }),
            };

            const getComponent = (props = {}) => <LoginWithQRSection {...defaultProps} {...props} />;

            let client: MatrixClient;
            beforeEach(() => {
                client = makeClient({});
                jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
            });

            test("no homeserver support", async () => {
                const { container } = render(getComponent({ versions: makeVersions({ "org.matrix.msc4108": false }) }));
                expect(container.textContent).toContain("Not supported by your account provider");
            });

            test("no support in crypto", async () => {
                client.getCrypto()!.exportSecretsBundle = undefined;
                const { container } = render(getComponent({ client }));
                expect(container.textContent).toContain("Not supported by your account provider");
            });

            test("failed to connect", async () => {
                fetchMock.catch(500);
                const { container } = render(getComponent({ client }));
                expect(container.textContent).toContain("Not supported by your account provider");
            });
        });
    });
});
