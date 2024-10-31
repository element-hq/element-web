/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, getByText, render } from "jest-matrix-react";
import React from "react";

import AccessibleButton from "../../../../../src/components/views/elements/AccessibleButton";
import { Key } from "../../../../../src/Keyboard";
import { mockPlatformPeg, unmockPlatformPeg } from "../../../../test-utils";

describe("<AccessibleButton />", () => {
    const defaultProps = {
        onClick: jest.fn(),
        children: "i am a button",
    };
    const getComponent = (props = {}) => render(<AccessibleButton {...defaultProps} {...props} />);

    beforeEach(() => {
        mockPlatformPeg();
    });

    afterAll(() => {
        unmockPlatformPeg();
    });

    it("renders div with role button by default", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("renders a button element", () => {
        const { asFragment } = getComponent({ element: "button" });
        expect(asFragment()).toMatchSnapshot();
    });

    it("renders with correct classes when button has kind", () => {
        const { asFragment } = getComponent({
            kind: "primary",
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("disables button correctly", () => {
        const onClick = jest.fn();
        const { container } = getComponent({
            onClick,
            disabled: true,
        });

        const btn = getByText(container, "i am a button");

        expect(btn.hasAttribute("disabled")).toBeTruthy();
        expect(btn.hasAttribute("aria-disabled")).toBeTruthy();

        fireEvent.click(btn);

        expect(onClick).not.toHaveBeenCalled();

        fireEvent.keyPress(btn, { key: Key.ENTER, code: Key.ENTER });

        expect(onClick).not.toHaveBeenCalled();
    });

    it("calls onClick handler on button click", () => {
        const onClick = jest.fn();
        const { container } = getComponent({
            onClick,
        });

        const btn = getByText(container, "i am a button");
        fireEvent.click(btn);

        expect(onClick).toHaveBeenCalled();
    });

    it("calls onClick handler on button mousedown when triggerOnMousedown is passed", () => {
        const onClick = jest.fn();
        const { container } = getComponent({
            onClick,
            triggerOnMouseDown: true,
        });

        const btn = getByText(container, "i am a button");
        fireEvent.mouseDown(btn);

        expect(onClick).toHaveBeenCalled();
    });

    describe("handling keyboard events", () => {
        it("calls onClick handler on enter keydown", () => {
            const onClick = jest.fn();
            const { container } = getComponent({
                onClick,
            });

            const btn = getByText(container, "i am a button");

            fireEvent.keyDown(btn, { key: Key.ENTER, code: Key.ENTER });

            expect(onClick).toHaveBeenCalled();

            fireEvent.keyUp(btn, { key: Key.ENTER, code: Key.ENTER });

            // handler only called once on keydown
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("calls onClick handler on space keyup", () => {
            const onClick = jest.fn();
            const { container } = getComponent({
                onClick,
            });
            const btn = getByText(container, "i am a button");

            fireEvent.keyDown(btn, { key: Key.SPACE, code: Key.SPACE });

            expect(onClick).not.toHaveBeenCalled();

            fireEvent.keyUp(btn, { key: Key.SPACE, code: Key.SPACE });

            // handler only called once on keyup
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("calls onKeydown/onKeyUp handlers for keys other than space and enter", () => {
            const onClick = jest.fn();
            const onKeyDown = jest.fn();
            const onKeyUp = jest.fn();
            const { container } = getComponent({
                onClick,
                onKeyDown,
                onKeyUp,
            });

            const btn = getByText(container, "i am a button");

            fireEvent.keyDown(btn, { key: Key.K, code: Key.K });
            fireEvent.keyUp(btn, { key: Key.K, code: Key.K });

            expect(onClick).not.toHaveBeenCalled();
            expect(onKeyDown).toHaveBeenCalled();
            expect(onKeyUp).toHaveBeenCalled();
        });

        it("does nothing on non space/enter key presses when no onKeydown/onKeyUp handlers provided", () => {
            const onClick = jest.fn();
            const { container } = getComponent({
                onClick,
            });

            const btn = getByText(container, "i am a button");

            fireEvent.keyDown(btn, { key: Key.K, code: Key.K });
            fireEvent.keyUp(btn, { key: Key.K, code: Key.K });

            expect(onClick).not.toHaveBeenCalled();
        });
    });
});
