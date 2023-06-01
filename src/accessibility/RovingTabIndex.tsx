/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useReducer,
    Reducer,
    Dispatch,
    RefObject,
    ReactNode,
} from "react";

import { getKeyBindingsManager } from "../KeyBindingsManager";
import { KeyBindingAction } from "./KeyboardShortcuts";
import { FocusHandler, Ref } from "./roving/types";

/**
 * Module to simplify implementing the Roving TabIndex accessibility technique
 *
 * Wrap the Widget in an RovingTabIndexContextProvider
 * and then for all buttons make use of useRovingTabIndex or RovingTabIndexWrapper.
 * The code will keep track of which tabIndex was most recently focused and expose that information as `isActive` which
 * can then be used to only set the tabIndex to 0 as expected by the roving tabindex technique.
 * When the active button gets unmounted the closest button will be chosen as expected.
 * Initially the first button to mount will be given active state.
 *
 * https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets#Technique_1_Roving_tabindex
 */

// Check for form elements which utilize the arrow keys for native functions
// like many of the text input varieties.
//
// i.e. it's ok to press the down arrow on a radio button to move to the next
// radio. But it's not ok to press the down arrow on a <input type="text"> to
// move away because the down arrow should move the cursor to the end of the
// input.
export function checkInputableElement(el: HTMLElement): boolean {
    return el.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable=true]');
}

export interface IState {
    activeRef?: Ref;
    refs: Ref[];
}

export interface IContext {
    state: IState;
    dispatch: Dispatch<IAction>;
}

export const RovingTabIndexContext = createContext<IContext>({
    state: {
        refs: [], // list of refs in DOM order
    },
    dispatch: () => {},
});
RovingTabIndexContext.displayName = "RovingTabIndexContext";

export enum Type {
    Register = "REGISTER",
    Unregister = "UNREGISTER",
    SetFocus = "SET_FOCUS",
    Update = "UPDATE",
}

export interface IAction {
    type: Exclude<Type, Type.Update>;
    payload: {
        ref: Ref;
    };
}

interface UpdateAction {
    type: Type.Update;
    payload?: undefined;
}

type Action = IAction | UpdateAction;

const refSorter = (a: Ref, b: Ref): number => {
    if (a === b) {
        return 0;
    }

    const position = a.current!.compareDocumentPosition(b.current!);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
        return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
        return 1;
    } else {
        return 0;
    }
};

export const reducer: Reducer<IState, Action> = (state: IState, action: Action) => {
    switch (action.type) {
        case Type.Register: {
            if (!state.activeRef) {
                // Our list of refs was empty, set activeRef to this first item
                state.activeRef = action.payload.ref;
            }

            // Sadly due to the potential of DOM elements swapping order we can't do anything fancy like a binary insert
            state.refs.push(action.payload.ref);
            state.refs.sort(refSorter);

            return { ...state };
        }

        case Type.Unregister: {
            const oldIndex = state.refs.findIndex((r) => r === action.payload.ref);

            if (oldIndex === -1) {
                return state; // already removed, this should not happen
            }

            if (state.refs.splice(oldIndex, 1)[0] === state.activeRef) {
                // we just removed the active ref, need to replace it
                // pick the ref closest to the index the old ref was in
                if (oldIndex >= state.refs.length) {
                    state.activeRef = findSiblingElement(state.refs, state.refs.length - 1, true);
                } else {
                    state.activeRef =
                        findSiblingElement(state.refs, oldIndex) || findSiblingElement(state.refs, oldIndex, true);
                }
                if (document.activeElement === document.body) {
                    // if the focus got reverted to the body then the user was likely focused on the unmounted element
                    state.activeRef?.current?.focus();
                }
            }

            // update the refs list
            return { ...state };
        }

        case Type.SetFocus: {
            // if the ref doesn't change just return the same object reference to skip a re-render
            if (state.activeRef === action.payload.ref) return state;
            // update active ref
            state.activeRef = action.payload.ref;
            return { ...state };
        }

        case Type.Update: {
            state.refs.sort(refSorter);
            return { ...state };
        }

        default:
            return state;
    }
};

interface IProps {
    handleLoop?: boolean;
    handleHomeEnd?: boolean;
    handleUpDown?: boolean;
    handleLeftRight?: boolean;
    children(renderProps: { onKeyDownHandler(ev: React.KeyboardEvent): void; onDragEndHandler(): void }): ReactNode;
    onKeyDown?(ev: React.KeyboardEvent, state: IState, dispatch: Dispatch<IAction>): void;
}

export const findSiblingElement = (
    refs: RefObject<HTMLElement>[],
    startIndex: number,
    backwards = false,
    loop = false,
): RefObject<HTMLElement> | undefined => {
    if (backwards) {
        for (let i = startIndex; i < refs.length && i >= 0; i--) {
            if (refs[i].current?.offsetParent !== null) {
                return refs[i];
            }
        }
        if (loop) {
            return findSiblingElement(refs.slice(startIndex + 1), refs.length - 1, true, false);
        }
    } else {
        for (let i = startIndex; i < refs.length && i >= 0; i++) {
            if (refs[i].current?.offsetParent !== null) {
                return refs[i];
            }
        }
        if (loop) {
            return findSiblingElement(refs.slice(0, startIndex), 0, false, false);
        }
    }
};

export const RovingTabIndexProvider: React.FC<IProps> = ({
    children,
    handleHomeEnd,
    handleUpDown,
    handleLeftRight,
    handleLoop,
    onKeyDown,
}) => {
    const [state, dispatch] = useReducer<Reducer<IState, Action>>(reducer, {
        refs: [],
    });

    const context = useMemo<IContext>(() => ({ state, dispatch }), [state]);

    const onKeyDownHandler = useCallback(
        (ev: React.KeyboardEvent) => {
            if (onKeyDown) {
                onKeyDown(ev, context.state, context.dispatch);
                if (ev.defaultPrevented) {
                    return;
                }
            }

            let handled = false;
            const action = getKeyBindingsManager().getAccessibilityAction(ev);
            let focusRef: RefObject<HTMLElement> | undefined;
            // Don't interfere with input default keydown behaviour
            // but allow people to move focus from it with Tab.
            if (checkInputableElement(ev.target as HTMLElement)) {
                switch (action) {
                    case KeyBindingAction.Tab:
                        handled = true;
                        if (context.state.refs.length > 0) {
                            const idx = context.state.refs.indexOf(context.state.activeRef!);
                            focusRef = findSiblingElement(
                                context.state.refs,
                                idx + (ev.shiftKey ? -1 : 1),
                                ev.shiftKey,
                            );
                        }
                        break;
                }
            } else {
                // check if we actually have any items
                switch (action) {
                    case KeyBindingAction.Home:
                        if (handleHomeEnd) {
                            handled = true;
                            // move focus to first (visible) item
                            focusRef = findSiblingElement(context.state.refs, 0);
                        }
                        break;

                    case KeyBindingAction.End:
                        if (handleHomeEnd) {
                            handled = true;
                            // move focus to last (visible) item
                            focusRef = findSiblingElement(context.state.refs, context.state.refs.length - 1, true);
                        }
                        break;

                    case KeyBindingAction.ArrowDown:
                    case KeyBindingAction.ArrowRight:
                        if (
                            (action === KeyBindingAction.ArrowDown && handleUpDown) ||
                            (action === KeyBindingAction.ArrowRight && handleLeftRight)
                        ) {
                            handled = true;
                            if (context.state.refs.length > 0) {
                                const idx = context.state.refs.indexOf(context.state.activeRef!);
                                focusRef = findSiblingElement(context.state.refs, idx + 1, false, handleLoop);
                            }
                        }
                        break;

                    case KeyBindingAction.ArrowUp:
                    case KeyBindingAction.ArrowLeft:
                        if (
                            (action === KeyBindingAction.ArrowUp && handleUpDown) ||
                            (action === KeyBindingAction.ArrowLeft && handleLeftRight)
                        ) {
                            handled = true;
                            if (context.state.refs.length > 0) {
                                const idx = context.state.refs.indexOf(context.state.activeRef!);
                                focusRef = findSiblingElement(context.state.refs, idx - 1, true, handleLoop);
                            }
                        }
                        break;
                }
            }

            if (handled) {
                ev.preventDefault();
                ev.stopPropagation();
            }

            if (focusRef) {
                focusRef.current?.focus();
                // programmatic focus doesn't fire the onFocus handler, so we must do the do ourselves
                dispatch({
                    type: Type.SetFocus,
                    payload: {
                        ref: focusRef,
                    },
                });
            }
        },
        [context, onKeyDown, handleHomeEnd, handleUpDown, handleLeftRight, handleLoop],
    );

    const onDragEndHandler = useCallback(() => {
        dispatch({
            type: Type.Update,
        });
    }, []);

    return (
        <RovingTabIndexContext.Provider value={context}>
            {children({ onKeyDownHandler, onDragEndHandler })}
        </RovingTabIndexContext.Provider>
    );
};

// Hook to register a roving tab index
// inputRef parameter specifies the ref to use
// onFocus should be called when the index gained focus in any manner
// isActive should be used to set tabIndex in a manner such as `tabIndex={isActive ? 0 : -1}`
// ref should be passed to a DOM node which will be used for DOM compareDocumentPosition
export const useRovingTabIndex = <T extends HTMLElement>(
    inputRef?: RefObject<T>,
): [FocusHandler, boolean, RefObject<T>] => {
    const context = useContext(RovingTabIndexContext);
    let ref = useRef<T>(null);

    if (inputRef) {
        // if we are given a ref, use it instead of ours
        ref = inputRef;
    }

    // setup (after refs)
    useLayoutEffect(() => {
        context.dispatch({
            type: Type.Register,
            payload: { ref },
        });
        // teardown
        return () => {
            context.dispatch({
                type: Type.Unregister,
                payload: { ref },
            });
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onFocus = useCallback(() => {
        context.dispatch({
            type: Type.SetFocus,
            payload: { ref },
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isActive = context.state.activeRef === ref;
    return [onFocus, isActive, ref];
};

// re-export the semantic helper components for simplicity
export { RovingTabIndexWrapper } from "./roving/RovingTabIndexWrapper";
export { RovingAccessibleButton } from "./roving/RovingAccessibleButton";
export { RovingAccessibleTooltipButton } from "./roving/RovingAccessibleTooltipButton";
