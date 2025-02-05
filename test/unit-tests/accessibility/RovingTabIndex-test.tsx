/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes } from "react";
import { act, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import {
    type IState,
    reducer,
    RovingTabIndexProvider,
    RovingTabIndexWrapper,
    Type,
    useRovingTabIndex,
} from "../../../src/accessibility/RovingTabIndex";

const Button = (props: HTMLAttributes<HTMLButtonElement>) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();
    return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
};

const checkTabIndexes = (buttons: NodeListOf<HTMLElement>, expectations: number[]) => {
    expect([...buttons].map((b) => b.tabIndex)).toStrictEqual(expectations);
};

const createButtonElement = (text: string): HTMLButtonElement => {
    const button = document.createElement("button");
    button.textContent = text;
    return button;
};

// give the buttons keys for the fibre reconciler to not treat them all as the same
const button1 = <Button key={1}>a</Button>;
const button2 = <Button key={2}>b</Button>;
const button3 = <Button key={3}>c</Button>;
const button4 = <Button key={4}>d</Button>;

// mock offsetParent
Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    get() {
        return this.parentNode;
    },
});

describe("RovingTabIndex", () => {
    it("RovingTabIndexProvider renders children as expected", () => {
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

    it("RovingTabIndexProvider works as expected with useRovingTabIndex", () => {
        const { container, rerender } = render(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        {button1}
                        {button2}
                        {button3}
                    </React.Fragment>
                )}
            </RovingTabIndexProvider>,
        );

        // should begin with 0th being active
        checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

        // focus on 2nd button and test it is the only active one
        act(() => container.querySelectorAll("button")[2].focus());
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);

        // focus on 1st button and test it is the only active one
        act(() => container.querySelectorAll("button")[1].focus());
        checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

        // check that the active button does not change even on an explicit blur event
        act(() => container.querySelectorAll("button")[1].blur());
        checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

        // update the children, it should remain on the same button
        rerender(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        {button1}
                        {button4}
                        {button2}
                        {button3}
                    </React.Fragment>
                )}
            </RovingTabIndexProvider>,
        );
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0, -1]);

        // update the children, remove the active button, it should move to the next one
        rerender(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        {button1}
                        {button4}
                        {button3}
                    </React.Fragment>
                )}
            </RovingTabIndexProvider>,
        );
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);
    });

    it("RovingTabIndexProvider provides a ref to the dom element", () => {
        const nodeRef = React.createRef<HTMLButtonElement>();
        const MyButton = (props: HTMLAttributes<HTMLButtonElement>) => {
            const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>(nodeRef);
            return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
        };
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        <MyButton />
                    </React.Fragment>
                )}
            </RovingTabIndexProvider>,
        );
        // nodeRef should point to button
        expect(nodeRef.current).toBe(container.querySelector("button"));
    });

    it("RovingTabIndexProvider works as expected with RovingTabIndexWrapper", () => {
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        {button1}
                        {button2}
                        <RovingTabIndexWrapper>
                            {({ onFocus, isActive, ref }) => (
                                <button onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref}>
                                    .
                                </button>
                            )}
                        </RovingTabIndexWrapper>
                    </React.Fragment>
                )}
            </RovingTabIndexProvider>,
        );

        // should begin with 0th being active
        checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

        // focus on 2nd button and test it is the only active one
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
                        type: Type.SetFocus,
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
            const button1 = createButtonElement("Button 1");
            const button2 = createButtonElement("Button 2");
            const button3 = createButtonElement("Button 3");
            const button4 = createButtonElement("Button 4");

            let state: IState = {
                nodes: [button1, button2, button3, button4],
            };

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: button2,
                },
            });
            expect(state).toStrictEqual({
                nodes: [button1, button3, button4],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: button3,
                },
            });
            expect(state).toStrictEqual({
                nodes: [button1, button4],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: button4,
                },
            });
            expect(state).toStrictEqual({
                nodes: [button1],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: button1,
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
                <React.Fragment>
                    <span ref={ref1} />
                    <span ref={ref2} />
                    <span ref={ref3} />
                    <span ref={ref4} />
                </React.Fragment>,
            );

            let state: IState = {
                nodes: [],
            };

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref1.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref3.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current, ref3.current],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref4.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref1.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            // test that the automatic focus switch works for unmounting
            state = reducer(state, {
                type: Type.SetFocus,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref2.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref1.current, ref3.current, ref4.current],
            });

            // test that the insert into the middle works as expected
            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref2.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref1.current, ref2.current, ref3.current, ref4.current],
            });

            // test that insertion at the edges works
            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: ref1.current!,
                },
            });
            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    node: ref4.current!,
                },
            });
            expect(state).toStrictEqual({
                activeNode: ref3.current,
                nodes: [ref2.current, ref3.current],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    node: ref1.current!,
                },
            });

            state = reducer(state, {
                type: Type.Register,
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

    describe("handles arrow keys", () => {
        it("should handle up/down arrow keys work when handleUpDown=true", async () => {
            const { container } = render(
                <RovingTabIndexProvider handleUpDown>
                    {({ onKeyDownHandler }) => (
                        <div onKeyDown={onKeyDownHandler}>
                            {button1}
                            {button2}
                            {button3}
                        </div>
                    )}
                </RovingTabIndexProvider>,
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

            // Does not loop without
            await userEvent.keyboard("[ArrowUp]");
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);
        });

        it("should call scrollIntoView if specified", async () => {
            const { container } = render(
                <RovingTabIndexProvider handleUpDown scrollIntoView>
                    {({ onKeyDownHandler }) => (
                        <div onKeyDown={onKeyDownHandler}>
                            {button1}
                            {button2}
                            {button3}
                        </div>
                    )}
                </RovingTabIndexProvider>,
            );

            act(() => container.querySelectorAll("button")[0].focus());
            checkTabIndexes(container.querySelectorAll("button"), [0, -1, -1]);

            const button = container.querySelectorAll("button")[1];
            const mock = jest.spyOn(button, "scrollIntoView");
            await userEvent.keyboard("[ArrowDown]");
            expect(mock).toHaveBeenCalled();
        });
    });
});
