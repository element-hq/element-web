/*
Copyright 2020 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { HTMLAttributes } from "react";
import { render } from "@testing-library/react";

import {
    IState,
    reducer,
    RovingTabIndexProvider,
    RovingTabIndexWrapper,
    Type,
    useRovingTabIndex,
} from "../../src/accessibility/RovingTabIndex";

const Button = (props: HTMLAttributes<HTMLButtonElement>) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLButtonElement>();
    return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
};

const checkTabIndexes = (buttons: NodeListOf<HTMLElement>, expectations: number[]) => {
    expect(buttons.length).toBe(expectations.length);
    for (let i = 0; i < buttons.length; i++) {
        expect(buttons[i].tabIndex).toBe(expectations[i]);
    }
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
        container.querySelectorAll("button")[2].focus();
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);

        // focus on 1st button and test it is the only active one
        container.querySelectorAll("button")[1].focus();
        checkTabIndexes(container.querySelectorAll("button"), [-1, 0, -1]);

        // check that the active button does not change even on an explicit blur event
        container.querySelectorAll("button")[1].blur();
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

    it("RovingTabIndexProvider works as expected with RovingTabIndexWrapper", () => {
        const { container } = render(
            <RovingTabIndexProvider>
                {() => (
                    <React.Fragment>
                        {button1}
                        {button2}
                        <RovingTabIndexWrapper>
                            {({ onFocus, isActive, ref }) => (
                                <button
                                    onFocus={onFocus}
                                    tabIndex={isActive ? 0 : -1}
                                    ref={ref as React.RefObject<HTMLButtonElement>}
                                >
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
        container.querySelectorAll("button")[2].focus();
        checkTabIndexes(container.querySelectorAll("button"), [-1, -1, 0]);
    });

    describe("reducer functions as expected", () => {
        it("SetFocus works as expected", () => {
            const ref1 = React.createRef<HTMLElement>();
            const ref2 = React.createRef<HTMLElement>();
            expect(
                reducer(
                    {
                        activeRef: ref1,
                        refs: [ref1, ref2],
                    },
                    {
                        type: Type.SetFocus,
                        payload: {
                            ref: ref2,
                        },
                    },
                ),
            ).toStrictEqual({
                activeRef: ref2,
                refs: [ref1, ref2],
            });
        });

        it("Unregister works as expected", () => {
            const ref1 = React.createRef<HTMLElement>();
            const ref2 = React.createRef<HTMLElement>();
            const ref3 = React.createRef<HTMLElement>();
            const ref4 = React.createRef<HTMLElement>();

            let state: IState = {
                refs: [ref1, ref2, ref3, ref4],
            };

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref2,
                },
            });
            expect(state).toStrictEqual({
                refs: [ref1, ref3, ref4],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref3,
                },
            });
            expect(state).toStrictEqual({
                refs: [ref1, ref4],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref4,
                },
            });
            expect(state).toStrictEqual({
                refs: [ref1],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref1,
                },
            });
            expect(state).toStrictEqual({
                refs: [],
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
                refs: [],
            };

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref1,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref1,
                refs: [ref1],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref2,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref1,
                refs: [ref1, ref2],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref3,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref1,
                refs: [ref1, ref2, ref3],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref4,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref1,
                refs: [ref1, ref2, ref3, ref4],
            });

            // test that the automatic focus switch works for unmounting
            state = reducer(state, {
                type: Type.SetFocus,
                payload: {
                    ref: ref2,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref2,
                refs: [ref1, ref2, ref3, ref4],
            });

            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref2,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref3,
                refs: [ref1, ref3, ref4],
            });

            // test that the insert into the middle works as expected
            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref2,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref3,
                refs: [ref1, ref2, ref3, ref4],
            });

            // test that insertion at the edges works
            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref1,
                },
            });
            state = reducer(state, {
                type: Type.Unregister,
                payload: {
                    ref: ref4,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref3,
                refs: [ref2, ref3],
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref1,
                },
            });

            state = reducer(state, {
                type: Type.Register,
                payload: {
                    ref: ref4,
                },
            });
            expect(state).toStrictEqual({
                activeRef: ref3,
                refs: [ref1, ref2, ref3, ref4],
            });
        });
    });
});
