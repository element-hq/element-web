/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, test, beforeAll, beforeEach, expect, vi } from "vitest";
import { render } from "test-utils-rtl";
import { type IClientWellKnown, type IServerVersions, type MatrixClient } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";

import LoginWithQRSection from "./LoginWithQRSection";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";

function makeClient(wellKnown: IClientWellKnown) {
    const crypto = vi.mocked({
        supportsSecretsForQrLogin: vi.fn().mockReturnValue(true),
        isCrossSigningReady: vi.fn().mockReturnValue(true),
    });

    return vi.mocked({
        getUser: vi.fn(),
        isGuest: vi.fn().mockReturnValue(false),
        isUserIgnored: vi.fn(),
        getUserId: vi.fn(),
        on: vi.fn(),
        isSynapseAdministrator: vi.fn().mockResolvedValue(false),
        isRoomEncrypted: vi.fn().mockReturnValue(false),
        mxcUrlToHttp: vi.fn().mockReturnValue("mock-mxcUrlToHttp"),
        removeListener: vi.fn(),
        currentState: {
            on: vi.fn(),
        },
        getClientWellKnown: vi.fn().mockReturnValue(wellKnown),
        getCrypto: vi.fn().mockReturnValue(crypto),
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
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(makeClient({}));
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
                vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
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
