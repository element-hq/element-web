/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { afterEach, describe, expect, it } from "vitest";

import ToastContainer from "./ToastContainer";
import ToastStore from "../../stores/ToastStore";

describe("ToastContainer", () => {
    afterEach(() => ToastStore.sharedInstance().reset());

    it("shows every ringing call, and only the top toast otherwise", () => {
        const store = ToastStore.sharedInstance();
        const Body = ({ text }: { text: string }): React.JSX.Element => <p>{text}</p>;
        for (const [key, text] of [
            ["a", "caller A"],
            ["b", "caller B"],
        ]) {
            store.addOrReplaceToast({
                key,
                priority: 100,
                component: Body,
                bodyClassName: "mx_IncomingCallToast",
                props: { text },
            });
        }
        store.addOrReplaceToast({ key: "c", priority: 10, component: Body, props: { text: "other" } });
        render(<ToastContainer />);

        expect(screen.getByText("caller A")).toBeVisible();
        expect(screen.getByText("caller B")).toBeVisible();
        expect(screen.queryByText("other")).toBeNull();
        // Portalled into the persisted elements' container, not the render root
        expect(document.querySelector(".mx_ToastContainer_stacked")).not.toBeNull();
    });
});
