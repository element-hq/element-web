/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes } from "react";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import {
    RovingAction,
    RovingStateActionType,
    RovingTabIndexProvider,
    RovingTabIndexWrapper,
    useRovingTabIndex,
} from ".";
import type { IState } from ".";
import { reducer } from "./RovingTabIndex";

const Button = (props: HTMLAttributes<HTMLButtonElement>): React.JSX.Element => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();
    return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
};

const checkTabIndexes = (buttons: NodeListOf<HTMLElement>, expectations: number[]): void => {
    expect([...buttons].map((b) => b.tabIndex)).toStrictEqual(expectations);
};

const createButtonElement = (text: string): HTMLButtonElement => {
    const button = document.createElement("button");
    button.textContent = text;
    return button;
};

const renderToolbar = (
    ui: React.ReactNode,
    props: Partial<React.ComponentProps<typeof RovingTabIndexProvider>> = {},
): ReturnType<typeof render> => {
    return render(
        <RovingTabIndexProvider {...props}>
            {({ onKeyDownHandler }) => (
                <div aria-label="Roving test container" onKeyDown={onKeyDownHandler} role="toolbar">
                    {ui}
                </div>
            )}
        </RovingTabIndexProvider>,
    );
};

const button1 = <Button key={1}>a</Button>;
const button2 = <Button key={2}>b</Button>;
const button3 = <Button key={3}>c</Button>;
const button4 = <Button key={4}>d</Button>;

Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    get() {
        return this.parentNode;
    },
});

describe("RovingTabIndex", () => {
    it("renders children as expected", () => {
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <div>
                        <span>Test</span>
                    </div>
                )}
            </RovingTabIndexProvider>,
        );
        expect(container.textContent).toBe("Test");
        expect(container.innerHTML).toBe("<div><span>Test</span></div>");
    });

    it("works as expected with useRovingTabIndex", () => {
        const { container, rerender } = render(
            <RovingTabIndexProvider>
                {() => (
                    <>
                        {button1}
                        {button2}
                        {button3}
                    </>
                )}
            </RovingTabIndexProvider>,
        );

        checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

        act(() => container.querySelectorAll("button")[2].focus());
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);

        act(() => container.querySelectorAll("button")[1].focus());
        checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

        act(() => container.querySelectorAll("button")[1].blur());
        checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

        rerender(
            <RovingTabIndexProvider>
                {() => (
                    <>
                        {button1}
                        {button4}
                        {button2}
                        {button3}
                    </>
                )}
            </RovingTabIndexProvider>,
        );
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0, -1]);

        rerender(
            <RovingTabIndexProvider>
                {() => (
                    <>
                        {button1}
                        {button4}
                        {button3}
                    </>
                )}
            </RovingTabIndexProvider>,
        );
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);
    });

    it("provides a ref to the dom element", () => {
        const nodeRef = React.createRef<HTMLButtonElement>();
        const MyButton = (props: HTMLAttributes<HTMLButtonElement>): React.JSX.Element => {
            const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>(nodeRef);
            return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
        };
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <>
                        <MyButton />
                    </>
                )}
            </RovingTabIndexProvider>,
        );
        expect(nodeRef.current).toBe(container.querySelector("button"));
    });

    it("works as expected with RovingTabIndexWrapper", () => {
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <>
                        {button1}
                        {button2}
                        <RovingTabIndexWrapper>
                            {({ onFocus, isActive, ref }) => (
                                <button onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref}>
                                    .
                                </button>
                            )}
                        </RovingTabIndexWrapper>
                    </>
                )}
            </RovingTabIndexProvider>,
        );

        checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

        act(() => container.querySelectorAll("button")[2].focus());
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);
    });

    describe("reducer functions as expected", () => {
        it("SetFocus works as expected", () => {
            const node1 = createButtonElement("Button 1");
            const node2 = createButtonElement("Button 2");
            expect(
                reducer(
                    {
                        activeNode: node1,
                        nodes: [node1, node2],
                    },
                    {
                        type: RovingStateActionType.SetFocus,
                        payload: {
                            node: node2,
                        },
                    },
                ),
            ).toStrictEqual({
                activeNode: node2,
                nodes: [node1, node2],
            });
        });

        it("Unregister works as expected", () => {
            const unregisterButton1 = createButtonElement("Button 1");
            const unregisterButton2 = createButtonElement("Button 2");
            const unregisterButton3 = createButtonElement("Button 3");
            const unregisterButton4 = createButtonElement("Button 4");

            let state: IState = {
                nodes: [unregisterButton1, unregisterButton2, unregisterButton3, unregisterButton4],
            };

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: unregisterButton2,
                },
            });
            expect(state).toStrictEqual({
                nodes: [unregisterButton1, unregisterButton3, unregisterButton4],
            });

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: unregisterButton3,
                },
            });
            expect(state).toStrictEqual({
                nodes: [unregisterButton1, unregisterButton4],
            });

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: unregisterButton4,
                },
            });
            expect(state).toStrictEqual({
                nodes: [unregisterButton1],
            });

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: unregisterButton1,
                },
            });
            expect(state).toStrictEqual({
                nodes: [],
            });
        });

        it("Register works as expected", () => {
            const ref1 = React.createRef<HTMLElement>();
            const ref2 = React.createRef<HTMLElement>();
            const ref3 = React.createRef<HTMLElement>();
            const ref4 = React.createRef<HTMLElement>();

            render(
                <>
                    <span ref={ref1} />
                    <span ref={ref2} />
                    <span ref={ref3} />
                    <span ref={ref4} />
                </>,
            );

            let state: IState = {
                nodes: [],
            };

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref1.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref3.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current, ref3.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref4.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.SetFocus,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref2.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref1.current, ref3.current, ref4.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: ref1.current!,
                },
            });
            state = reducer(state, {
                type: RovingStateActionType.Unregister,
                payload: {
                    node: ref4.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref2.current, ref3.current],
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref1.current!,
                },
            });

            state = reducer(state, {
                type: RovingStateActionType.Register,
                payload: {
                    node: ref4.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });
        });
    });

    describe("handles keyboard navigation", () => {
        it("handles up/down arrow keys when handleUpDown=true", async () => {
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleUpDown: true },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

            await userEvent.keyboard("[ArrowDown]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

            await userEvent.keyboard("[ArrowDown]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);

            await userEvent.keyboard("[ArrowUp]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

            await userEvent.keyboard("[ArrowUp]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

            await userEvent.keyboard("[ArrowUp]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);
        });

        it("handles left/right arrow keys when handleLeftRight=true", async () => {
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleLeftRight: true },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            await userEvent.keyboard("[ArrowRight]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

            await userEvent.keyboard("[ArrowLeft]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);
        });

        it("handles Home and End when handleHomeEnd=true", async () => {
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleHomeEnd: true },
            );

            act(() => container.querySelectorAll("button")[1].focus());
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

            await userEvent.keyboard("[End]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);

            await userEvent.keyboard("[Home]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);
        });

        it("loops when handleLoop=true", async () => {
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleUpDown: true, handleLoop: true },
            );

            act(() => container.querySelectorAll("button")[2].focus());
            await userEvent.keyboard("[ArrowDown]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

            await userEvent.keyboard("[ArrowUp]");
            checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);
        });

        it("uses a custom getAction mapper", async () => {
            const getAction = vi.fn((ev: React.KeyboardEvent): RovingAction | undefined => {
                if (ev.key === "j") {
                    return RovingAction.ArrowDown;
                }

                return undefined;
            });

            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleUpDown: true, getAction },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            await userEvent.keyboard("j");

            expect(getAction).toHaveBeenCalled();
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);
        });

        it("handles input fields when handleInputFields=true", () => {
            const { container, getByRole } = renderToolbar(
                <>
                    {button1}
                    <input aria-label="Search input" />
                    {button2}
                </>,
                { handleUpDown: true, handleInputFields: true },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            const input = getByRole("textbox", { name: "Search input" });

            fireEvent.keyDown(input, { key: "ArrowDown" });
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0]);
        });

        it("moves from an input field with Tab when handleInputFields=false", () => {
            const { container, getByRole } = renderToolbar(
                <>
                    {button1}
                    <input aria-label="Search input" />
                    {button2}
                </>,
            );

            act(() => container.querySelectorAll("button")[0].focus());
            const input = getByRole("textbox", { name: "Search input" });
            act(() => (input as HTMLElement).focus());

            fireEvent.keyDown(input, { key: "Tab" });
            checkTabIndexes(container.querySelectorAll("button"), [-1, 0]);
        });

        it("stops provider processing when onKeyDown prevents default", () => {
            const onKeyDown = vi.fn((event: React.KeyboardEvent): void => {
                event.preventDefault();
            });
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleUpDown: true, onKeyDown },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            fireEvent.keyDown(container.querySelector('[role="toolbar"]')!, { key: "ArrowDown" });

            expect(onKeyDown).toHaveBeenCalled();
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);
        });

        it("calls scrollIntoView if specified", async () => {
            const { container } = renderToolbar(
                <>
                    {button1}
                    {button2}
                    {button3}
                </>,
                { handleUpDown: true, scrollIntoView: true },
            );

            act(() => container.querySelectorAll("button")[0].focus());
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

            const button = container.querySelectorAll("button")[1];
            const mock = vi.spyOn(button, "scrollIntoView");
            await userEvent.keyboard("[ArrowDown]");
            expect(mock).toHaveBeenCalled();
        });
    });
});
