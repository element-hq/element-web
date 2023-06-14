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

import { render } from "@testing-library/react";
import { mocked } from "jest-mock";
import { IServerVersions, MatrixClient, UNSTABLE_MSC3882_CAPABILITY } from "matrix-js-sdk/src/matrix";
import React from "react";

import LoginWithQRSection from "../../../../../src/components/views/settings/devices/LoginWithQRSection";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

function makeClient() {
    return mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        isCryptoEnabled: jest.fn(),
        getUserId: jest.fn(),
        on: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
        removeListener: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
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
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(makeClient());
    });

    const defaultProps = {
        onShowQr: () => {},
        versions: makeVersions({}),
    };

    const getComponent = (props = {}) => <LoginWithQRSection {...defaultProps} {...props} />;

    describe("should not render", () => {
        it("no support at all", () => {
            const { container } = render(getComponent());
            expect(container).toMatchSnapshot();
        });

        it("only MSC3882 enabled", async () => {
            const { container } = render(getComponent({ versions: makeVersions({ "org.matrix.msc3882": true }) }));
            expect(container).toMatchSnapshot();
        });

        it("only MSC3882 r1 enabled", async () => {
            const { container } = render(
                getComponent({ capabilities: { [UNSTABLE_MSC3882_CAPABILITY.name]: { enabled: true } } }),
            );
            expect(container).toMatchSnapshot();
        });

        it("MSC3886 + MSC3882 r1 disabled", async () => {
            const { container } = render(
                getComponent({
                    versions: makeVersions({ "org.matrix.msc3886": true }),
                    capabilities: { [UNSTABLE_MSC3882_CAPABILITY.name]: { enabled: false } },
                }),
            );
            expect(container).toMatchSnapshot();
        });
    });

    describe("should render panel", () => {
        it("MSC3882 + MSC3886", async () => {
            const { container } = render(
                getComponent({
                    versions: makeVersions({
                        "org.matrix.msc3882": true,
                        "org.matrix.msc3886": true,
                    }),
                }),
            );
            expect(container).toMatchSnapshot();
        });

        it("MSC3882 r1 + MSC3886", async () => {
            const { container } = render(
                getComponent({
                    versions: makeVersions({
                        "org.matrix.msc3886": true,
                    }),
                    capabilities: {
                        [UNSTABLE_MSC3882_CAPABILITY.name]: { enabled: true },
                    },
                }),
            );
            expect(container).toMatchSnapshot();
        });
    });
});
