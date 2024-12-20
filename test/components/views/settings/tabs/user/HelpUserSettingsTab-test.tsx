/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { CryptoApi } from "matrix-js-sdk/src/crypto-api";

import HelpUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/HelpUserSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { ModuleRunner } from "../../../../../../src/modules/ModuleRunner";

describe("HelpUserSettingsTab", () => {
    const mockCryptoApi: unknown | CryptoApi = {
        globalBlacklistUnverifiedDevices: false,
        getVersion: jest.fn().mockReturnValue("1.0.0"),
        getOwnDeviceKeys: jest.fn().mockResolvedValue({
            ed25519: "123",
            curve25519: "456",
        }),
    };

    const contextValue = {
        getCrypto: () => mockCryptoApi as unknown as CryptoApi,
        getHomeserverUrl: jest.fn().mockReturnValue("https://matrix.org"),
        getIdentityServerUrl: jest.fn().mockReturnValue("https://vector.im"),
        getAccessToken: jest.fn().mockReturnValue("access_token"),
    };

    const renderComp = () =>
        render(
            <MatrixClientContext.Provider value={contextValue as unknown as MatrixClient}>
                <HelpUserSettingsTab />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Verji removed/hidden sourcecode
    it.skip("should render", () => {
        renderComp();
        screen.debug();
        expect(screen.getByText("Clear cache and reload")).toBeDefined();
    });

    describe("wrap the HelpUserSettingsTab with a React.Fragment", () => {
        // Verji removed/hidden sourcecode
        it.skip("should wrap the HelpUserSettingsTab with a React.Fragment", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.HelpUserSettingsTab) {
                    (opts as CustomComponentOpts).CustomComponent = ({ children }) => {
                        return (
                            <>
                                <div data-testid="wrapper-header">Header</div>
                                <div data-testid="wrapper-HelpUserSettingsTab">{children}</div>
                                <div data-testid="wrapper-footer">Footer</div>
                            </>
                        );
                    };
                }
            });

            renderComp();
            expect(screen.getByTestId("wrapper-header")).toBeDefined();
            expect(screen.getByTestId("wrapper-HelpUserSettingsTab")).toBeDefined();
            expect(screen.getByTestId("wrapper-footer")).toBeDefined();
            expect(screen.getByTestId("wrapper-header").nextSibling).toBe(
                screen.getByTestId("wrapper-HelpUserSettingsTab"),
            );
            expect(screen.getByTestId("wrapper-HelpUserSettingsTab").nextSibling).toBe(
                screen.getByTestId("wrapper-footer"),
            );
            expect(screen.getByText("Clear cache and reload")).toBeDefined();
        });
    });
});
