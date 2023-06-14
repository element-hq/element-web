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

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import LabelledCheckbox from "../../../../src/components/views/elements/LabelledCheckbox";

// Fake random strings to give a predictable snapshot for checkbox IDs
jest.mock("matrix-js-sdk/src/randomstring", () => {
    return {
        randomString: () => "abdefghi",
    };
});

describe("<LabelledCheckbox />", () => {
    type CompProps = React.ComponentProps<typeof LabelledCheckbox>;
    const getComponent = (props: CompProps) => <LabelledCheckbox {...props} />;
    const getCheckbox = (): HTMLInputElement => screen.getByRole("checkbox");

    it.each([undefined, "this is a byline"])("should render with byline of %p", (byline) => {
        const props: CompProps = {
            label: "Hello world",
            value: true,
            byline: byline,
            onChange: jest.fn(),
        };
        const renderResult = render(getComponent(props));
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should support unchecked by default", () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        render(getComponent(props));
        expect(getCheckbox()).not.toBeChecked();
    });

    it("should be possible to disable the checkbox", () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            disabled: true,
            onChange: jest.fn(),
        };
        render(getComponent(props));
        expect(getCheckbox()).toBeDisabled();
    });

    it("should emit onChange calls", () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        render(getComponent(props));

        expect(props.onChange).not.toHaveBeenCalled();
        fireEvent.click(getCheckbox());
        expect(props.onChange).toHaveBeenCalledWith(true);
    });

    it("should react to value and disabled prop changes", () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        const { rerender } = render(getComponent(props));

        let checkbox = getCheckbox();
        expect(checkbox).not.toBeChecked();
        expect(checkbox).not.toBeDisabled();

        props.disabled = true;
        props.value = true;
        rerender(getComponent(props));

        checkbox = getCheckbox();
        expect(checkbox).toBeChecked();
        expect(checkbox).toBeDisabled();
    });
});
