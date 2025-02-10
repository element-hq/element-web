/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, type RenderResult } from "jest-matrix-react";
import React, { type ComponentProps } from "react";

import GenericToast from "../../../../../src/components/views/toasts/GenericToast";

const renderGenericToast = (props: Partial<ComponentProps<typeof GenericToast>> = {}): RenderResult => {
    const propsWithDefaults = {
        primaryLabel: "Accept",
        description: <div>Description</div>,
        onPrimaryClick: () => {},
        onSecondaryClick: () => {},
        secondaryLabel: "Reject",
        ...props,
    };

    return render(<GenericToast {...propsWithDefaults} />);
};

describe("GenericToast", () => {
    it("should render as expected with detail content", () => {
        const { asFragment } = renderGenericToast();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render as expected without detail content", () => {
        const { asFragment } = renderGenericToast({
            detail: "Detail",
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
