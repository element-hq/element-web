/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useReducer,
    type Reducer,
    type Dispatch,
    type RefObject,
    type ReactNode,
    type RefCallback,
} from "react";

import { getKeyBindingsManager } from "../KeyBindingsManager";
import { KeyBindingAction } from "./KeyboardShortcuts";
import { type FocusHandler } from "./roving/types";

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
    activeNode?: HTMLElement;
    nodes: HTMLElement[];
}

export interface IContext {
    state: IState;
    dispatch: Dispatch<IAction>;
}

export const RovingTabIndexContext = createContext<IContext>({
    state: {
        nodes: [], // list of nodes in DOM order
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
        node: HTMLElement;
    };
}

interface UpdateAction {
    type: Type.Update;
    payload?: undefined;
}

type Action = IAction | UpdateAction;

const nodeSorter = (a: HTMLElement, b: HTMLElement): number => {
    if (a === b) {
        return 0;
    }

    const position = a.compareDocumentPosition(b);

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
            if (!state.activeNode) {
                // Our list of nodes was empty, set activeNode to this first item
                state.activeNode = action.payload.node;
            }

            if (state.nodes.includes(action.payload.node)) return state;

            // Sadly due to the potential of DOM elements swapping order we can't do anything fancy like a binary insert
            state.nodes.push(action.payload.node);
            state.nodes.sort(nodeSorter);

            return { ...state };
        }

        case Type.Unregister: {
            const oldIndex = state.nodes.findIndex((r) => r === action.payload.node);

            if (oldIndex === -1) {
                return state; // already removed, this should not happen
            }

            if (state.nodes.splice(oldIndex, 1)[0] === state.activeNode) {
                // we just removed the active node, need to replace it
                // pick the node closest to the index the old node was in
                if (oldIndex >= state.nodes.length) {
                    state.activeNode = findSiblingElement(state.nodes, state.nodes.length - 1, true);
                } else {
                    state.activeNode =
                        findSiblingElement(state.nodes, oldIndex) || findSiblingElement(state.nodes, oldIndex, true);
                }
                if (document.activeElement === document.body) {
                    // if the focus got reverted to the body then the user was likely focused on the unmounted element
                    setTimeout(() => state.activeNode?.focus(), 0);
                }
            }

            // update the nodes list
            return { ...state };
        }

        case Type.SetFocus: {
            // if the node doesn't change just return the same object reference to skip a re-render
            if (state.activeNode === action.payload.node) return state;
            // update active node
            state.activeNode = action.payload.node;
            return { ...state };
        }

        case Type.Update: {
            state.nodes.sort(nodeSorter);
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
    handleInputFields?: boolean;
    scrollIntoView?: boolean | ScrollIntoViewOptions;
    children(renderProps: { onKeyDownHandler(ev: React.KeyboardEvent): void; onDragEndHandler(): void }): ReactNode;
    onKeyDown?(ev: React.KeyboardEvent, state: IState, dispatch: Dispatch<IAction>): void;
}

export const findSiblingElement = (
    nodes: HTMLElement[],
    startIndex: number,
    backwards = false,
    loop = false,
): HTMLElement | undefined => {
    if (backwards) {
        for (let i = startIndex; i < nodes.length && i >= 0; i--) {
            if (nodes[i]?.offsetParent !== null) {
                return nodes[i];
            }
        }
        if (loop) {
            return findSiblingElement(nodes.slice(startIndex + 1), nodes.length - 1, true, false);
        }
    } else {
        for (let i = startIndex; i < nodes.length && i >= 0; i++) {
            if (nodes[i]?.offsetParent !== null) {
                return nodes[i];
            }
        }
        if (loop) {
            return findSiblingElement(nodes.slice(0, startIndex), 0, false, false);
        }
    }
};

export const RovingTabIndexProvider: React.FC<IProps> = ({
    children,
    handleHomeEnd,
    handleUpDown,
    handleLeftRight,
    handleLoop,
    handleInputFields,
    scrollIntoView,
    onKeyDown,
}) => {
    const [state, dispatch] = useReducer<Reducer<IState, Action>>(reducer, {
        nodes: [],
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
            let focusNode: HTMLElement | undefined;
            // Don't interfere with input default keydown behaviour
            // but allow people to move focus from it with Tab.
            if (!handleInputFields && checkInputableElement(ev.target as HTMLElement)) {
                switch (action) {
                    case KeyBindingAction.Tab:
                        handled = true;
                        if (context.state.nodes.length > 0) {
                            const idx = context.state.nodes.indexOf(context.state.activeNode!);
                            focusNode = findSiblingElement(
                                context.state.nodes,
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
                            focusNode = findSiblingElement(context.state.nodes, 0);
                        }
                        break;

                    case KeyBindingAction.End:
                        if (handleHomeEnd) {
                            handled = true;
                            // move focus to last (visible) item
                            focusNode = findSiblingElement(context.state.nodes, context.state.nodes.length - 1, true);
                        }
                        break;

                    case KeyBindingAction.ArrowDown:
                    case KeyBindingAction.ArrowRight:
                        if (
                            (action === KeyBindingAction.ArrowDown && handleUpDown) ||
                            (action === KeyBindingAction.ArrowRight && handleLeftRight)
                        ) {
                            handled = true;
                            if (context.state.nodes.length > 0) {
                                const idx = context.state.nodes.indexOf(context.state.activeNode!);
                                focusNode = findSiblingElement(context.state.nodes, idx + 1, false, handleLoop);
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
                            if (context.state.nodes.length > 0) {
                                const idx = context.state.nodes.indexOf(context.state.activeNode!);
                                focusNode = findSiblingElement(context.state.nodes, idx - 1, true, handleLoop);
                            }
                        }
                        break;
                }
            }

            if (handled) {
                ev.preventDefault();
                ev.stopPropagation();
            }

            if (focusNode) {
                focusNode?.focus();
                // programmatic focus doesn't fire the onFocus handler, so we must do the do ourselves
                dispatch({
                    type: Type.SetFocus,
                    payload: {
                        node: focusNode,
                    },
                });
                if (scrollIntoView) {
                    focusNode?.scrollIntoView(scrollIntoView);
                }
            }
        },
        [
            context,
            onKeyDown,
            handleHomeEnd,
            handleUpDown,
            handleLeftRight,
            handleLoop,
            handleInputFields,
            scrollIntoView,
        ],
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

/**
 * Hook to register a roving tab index.
 *
 * inputRef is an optional argument; when passed this ref points to the DOM element
 * to which the callback ref is attached.
 *
 * Returns:
 * onFocus should be called when the index gained focus in any manner.
 * isActive should be used to set tabIndex in a manner such as `tabIndex={isActive ? 0 : -1}`.
 * ref is a callback ref that should be passed to a DOM node which will be used for DOM compareDocumentPosition.
 * nodeRef is a ref that points to the DOM element to which the ref mentioned above is attached.
 *
 * nodeRef = inputRef when inputRef argument is provided.
 */
export const useRovingTabIndex = <T extends HTMLElement>(
    inputRef?: RefObject<T>,
): [FocusHandler, boolean, RefCallback<T>, RefObject<T | null>] => {
    const context = useContext(RovingTabIndexContext);

    let nodeRef = useRef<T | null>(null);

    if (inputRef) {
        // if we are given a ref, use it instead of ours
        nodeRef = inputRef;
    }

    const ref = useCallback((node: T | null) => {
        if (node) {
            nodeRef.current = node;
            context.dispatch({
                type: Type.Register,
                payload: { node },
            });
        } else {
            context.dispatch({
                type: Type.Unregister,
                payload: { node: nodeRef.current! },
            });
            nodeRef.current = null;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onFocus = useCallback(() => {
        if (!nodeRef.current) {
            console.warn("useRovingTabIndex.onFocus called but the react ref does not point to any DOM element!");
            return;
        }
        context.dispatch({
            type: Type.SetFocus,
            payload: { node: nodeRef.current },
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // eslint-disable-next-line react-compiler/react-compiler
    const isActive = context.state.activeNode === nodeRef.current;
    return [onFocus, isActive, ref, nodeRef];
};

// re-export the semantic helper components for simplicity
export { RovingTabIndexWrapper } from "./roving/RovingTabIndexWrapper";
export { RovingAccessibleButton } from "./roving/RovingAccessibleButton";
