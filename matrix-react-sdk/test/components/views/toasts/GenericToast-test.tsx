/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { render, RenderResult } from "@testing-library/react";
import React, { ComponentProps } from "react";

import GenericToast from "../../../../src/components/views/toasts/GenericToast";

const renderGenericToast = (props: Partial<ComponentProps<typeof GenericToast>> = {}): RenderResult => {
    const propsWithDefaults = {
        acceptLabel: "Accept",
        description: <div>Description</div>,
        onAccept: () => {},
        onReject: () => {},
        rejectLabel: "Reject",
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
