/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, render, screen } from "jest-matrix-react";
import React from "react";

import LabelledCheckbox from "../../../../../src/components/views/elements/LabelledCheckbox";

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

    it("should render with a custom class name", () => {
        const className = "some class name";
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
            className,
        };
        const { container } = render(getComponent(props));
        expect(container.firstElementChild?.className).toContain(className);
    });
});
