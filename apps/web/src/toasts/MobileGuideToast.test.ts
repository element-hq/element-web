/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"navigator": {"userAgent": "Mozilla/5.0 (iPod touch; CPU iPhone OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H321 Safari/600.1.4" }}}

import { type ComponentProps } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ToastStore from "../stores/ToastStore.ts";
import { showToast } from "./MobileGuideToast.ts";
import type GenericToast from "../components/views/toasts/GenericToast.tsx";

describe("showToast", () => {
    const addOrReplaceToastSpy = vi.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");

    beforeEach(() => {
        sessionStorage.clear();
    });

    it("should do nothing if sessionStorage has `skip_mobile_redirect`", () => {
        sessionStorage.setItem("skip_mobile_redirect", "true");

        showToast();
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });

    it("should set sessionStorage `skip_mobile_redirect` on reject", () => {
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBeFalsy();

        showToast();
        const toast = addOrReplaceToastSpy.mock.calls[0][0];
        expect((toast.props as ComponentProps<typeof GenericToast>).secondaryLabel).toBe("Dismiss");
        (toast.props as ComponentProps<typeof GenericToast>).onSecondaryClick!();
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBe("true");
    });
});
