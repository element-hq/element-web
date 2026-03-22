/*
Copyright 2026 tim2zg

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";
import { NetworkProxyViewModelImpl, NetworkProxyView } from "@element-hq/web-shared-components";

import { NetworkProxyModal } from "../../../../../src/components/views/settings/NetworkProxyModal";
import SettingsStore from "../../../../../src/settings/SettingsStore";

jest.mock("@element-hq/web-shared-components", () => ({
    ...jest.requireActual("@element-hq/web-shared-components"),
    NetworkProxyViewModelImpl: jest.fn(),
    NetworkProxyView: jest.fn(() => <div data-testid="proxy-view" />),
    useCreateAutoDisposedViewModel: jest.fn((factory) => factory()),
}));

jest.mock("../../../../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
    setValue: jest.fn(),
}));

jest.mock("../../../../../src/languageHandler", () => ({
    _t: jest.fn((key) => key),
}));

describe("NetworkProxyModal", () => {
    const onFinished = jest.fn();
    let mockVm: any;

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsStore.getValue as jest.Mock).mockReturnValue({ mode: "system" });
        
        mockVm = {
            updateMode: jest.fn(),
            save: jest.fn(),
            cancel: jest.fn(),
        };
        (NetworkProxyViewModelImpl as jest.Mock).mockImplementation(() => mockVm);
    });

    const renderModal = () => render(
        <TooltipProvider>
            <NetworkProxyModal onFinished={onFinished} />
        </TooltipProvider>
    );

    it("renders the modal and initializes the view model", async () => {
        await act(async () => {
            renderModal();
        });
        
        expect(NetworkProxyViewModelImpl).toHaveBeenCalledWith(expect.objectContaining({
            initialConfig: { mode: "system" },
        }));
        expect(screen.getByTestId("proxy-view")).toBeInTheDocument();
    });
});
