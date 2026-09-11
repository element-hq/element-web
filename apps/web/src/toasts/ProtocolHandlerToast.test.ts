/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { type ComponentProps } from "react";
import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from "vitest";

import ToastStore from "../stores/ToastStore.ts";
import SdkConfig from "../SdkConfig.ts";
import SettingsStore from "../settings/SettingsStore.ts";
import { SettingLevel } from "../settings/SettingLevel.ts";
import PlatformPeg from "../PlatformPeg.ts";
import type BasePlatform from "../BasePlatform.ts";
import { showToast } from "./ProtocolHandlerToast.ts";
import type GenericToast from "../components/views/toasts/GenericToast.tsx";

describe("ProtocolHandlerToast", () => {
    let addOrReplaceToastSpy: MockInstance<ToastStore["addOrReplaceToast"]>;
    let supportsRegisterProtocolHandler: boolean;

    const getToastProps = (): ComponentProps<typeof GenericToast> =>
        addOrReplaceToastSpy.mock.calls[0][0].props as ComponentProps<typeof GenericToast>;

    beforeEach(() => {
        localStorage.clear();
        supportsRegisterProtocolHandler = true;

        SdkConfig.put({ protocol_handler_nag_toast: true });
        addOrReplaceToastSpy = vi.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        vi.spyOn(PlatformPeg, "get").mockReturnValue({
            supportsRegisterProtocolHandler: async () => supportsRegisterProtocolHandler,
        } as unknown as BasePlatform);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        SdkConfig.reset();
    });

    it("should show the toast when the config option is enabled", async () => {
        await showToast();
        expect(addOrReplaceToastSpy).toHaveBeenCalled();
        expect(getToastProps().description).toMatchInlineSnapshot(
            `"Let Element open matrix: links to rooms, people and messages."`,
        );
    });

    it("should do nothing if the config option is not enabled", async () => {
        SdkConfig.reset();

        await showToast();
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });

    it("should do nothing if the platform cannot register a protocol handler", async () => {
        supportsRegisterProtocolHandler = false;

        await showToast();
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });

    it("should do nothing if the handler is already registered", async () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        await showToast();
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });

    it("should register the protocol handler on accept", async () => {
        await showToast();
        getToastProps().onPrimaryClick();

        expect(SettingsStore.setValue).toHaveBeenCalledWith(
            "protocolHandlerRegistered",
            null,
            SettingLevel.DEVICE,
            true,
        );
    });

    it("should not register the protocol handler on dismiss", async () => {
        await showToast();
        getToastProps().onSecondaryClick!();

        expect(SettingsStore.setValue).not.toHaveBeenCalled();
    });

    it.each([
        ["accept", (props: ComponentProps<typeof GenericToast>) => props.onPrimaryClick()],
        ["dismiss", (props: ComponentProps<typeof GenericToast>) => props.onSecondaryClick!()],
    ])("should not nag again once the user has chosen to %s", async (_name, click) => {
        await showToast();
        click(getToastProps());
        addOrReplaceToastSpy.mockClear();

        await showToast();
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });
});
