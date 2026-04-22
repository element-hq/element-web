/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useReducer,
    type Dispatch,
    type KeyboardEvent,
    type ReactNode,
    type Reducer,
    type RefCallback,
    type RefObject,
} from "react";

/**
 * Returns whether an element should keep native arrow-key behaviour instead of
 * being intercepted by roving focus navigation.
 *
 * This excludes radio buttons and checkboxes, which commonly participate in
 * directional navigation patterns.
 *
 * @param el - The element being evaluated for native input behaviour.
 * @returns `true` when the element should keep its own arrow-key handling.
 */
export function checkInputableElement(el: HTMLElement): boolean {
    return el.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable=true]');
}

/**
 * The current state of a roving tabindex group.
 */
export interface IState {
    /**
     * The element that currently owns the active tab stop.
     */
    activeNode?: HTMLElement;
    /**
     * Registered elements in DOM order.
     */
    nodes: HTMLElement[];
}

/**
 * The value exposed by {@link RovingTabIndexContext}.
 */
export interface IContext {
    state: IState;
    dispatch: Dispatch<IAction>;
}

/**
 * React context used by roving tabindex participants to register themselves and
 * update the active item.
 */
export const RovingTabIndexContext = createContext<IContext>({
    state: {
        nodes: [], // list of nodes in DOM order
    },
    dispatch: () => {},
});
RovingTabIndexContext.displayName = "RovingTabIndexContext";

/**
 * Internal reducer action kinds used by the roving tabindex state machine.
 */
export enum RovingStateActionType {
    Register = "REGISTER",
    Unregister = "UNREGISTER",
    SetFocus = "SET_FOCUS",
    Update = "UPDATE",
}

/**
 * An action dispatched to the roving tabindex reducer for node registration and
 * focus updates.
 */
export interface IAction {
    /**
     * The reducer action kind.
     */
    type: Exclude<RovingStateActionType, RovingStateActionType.Update>;
    /**
     * Action payload carrying the target node.
     */
    payload: {
        /**
         * The DOM node affected by the action.
         */
        node: HTMLElement;
    };
}

interface UpdateAction {
    type: RovingStateActionType.Update;
    payload?: undefined;
}

type Action = IAction | UpdateAction;

/**
 * Normalized navigation intents understood by the shared roving provider.
 */
export enum RovingAction {
    Home = "HOME",
    End = "END",
    ArrowLeft = "ARROW_LEFT",
    ArrowUp = "ARROW_UP",
    ArrowRight = "ARROW_RIGHT",
    ArrowDown = "ARROW_DOWN",
    Tab = "TAB",
}

/**
 * Props for {@link RovingTabIndexProvider}.
 */
export interface RovingTabIndexProviderProps {
    /**
     * Whether directional navigation should wrap from the last item to the first
     * and vice versa.
     */
    handleLoop?: boolean;
    /**
     * Whether `Home` and `End` should move focus to the first and last item.
     */
    handleHomeEnd?: boolean;
    /**
     * Whether vertical arrow keys should move focus within the group.
     */
    handleUpDown?: boolean;
    /**
     * Whether horizontal arrow keys should move focus within the group.
     */
    handleLeftRight?: boolean;
    /**
     * Whether text inputs and similar controls should participate in roving
     * keyboard handling instead of keeping their native arrow-key behaviour.
     */
    handleInputFields?: boolean;
    /**
     * Whether newly focused items should be scrolled into view.
     *
     * Pass `true` to use the browser default, or a scroll options object to
     * control alignment and behaviour.
     */
    scrollIntoView?: boolean | ScrollIntoViewOptions;
    /**
     * Render prop receiving keyboard and drag-end handlers for the roving
     * container.
     */
    children(
        this: void,
        renderProps: {
            /**
             * Handles keyboard navigation for the roving container.
             */
            onKeyDownHandler(this: void, ev: KeyboardEvent): void;
            /**
             * Re-sorts registered elements after DOM reordering, such as drag and
             * drop.
             */
            onDragEndHandler(this: void): void;
        },
    ): ReactNode;
    /**
     * Optional callback invoked before the provider performs its own keyboard
     * handling.
     *
     * Call `preventDefault()` on the event to suppress the built-in behaviour.
     */
    onKeyDown?(this: void, ev: KeyboardEvent, state: IState, dispatch: Dispatch<IAction>): void;
    /**
     * Optional action resolver used to map keyboard events to
     * {@link RovingAction} values.
     *
     * When omitted, a default mapping based on `KeyboardEvent.key` is used.
     */
    getAction?(this: void, ev: KeyboardEvent): RovingAction | undefined;
}

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

/**
 * Reducer that tracks registered nodes and the currently active roving tab
 * stop.
 */
export const reducer: Reducer<IState, Action> = (state: IState, action: Action) => {
    switch (action.type) {
        case RovingStateActionType.Register: {
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

        case RovingStateActionType.Unregister: {
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

            return { ...state };
        }

        case RovingStateActionType.SetFocus: {
            if (state.activeNode === action.payload.node) return state;
            state.activeNode = action.payload.node;
            return { ...state };
        }

        case RovingStateActionType.Update: {
            state.nodes.sort(nodeSorter);
            return { ...state };
        }

        default:
            return state;
    }
};

/**
 * Finds the next visible sibling element starting from a given index.
 *
 * @param nodes - Registered roving nodes in DOM order.
 * @param startIndex - The index to begin searching from.
 * @param backwards - Whether to search backwards.
 * @param loop - Whether to wrap around when no visible sibling is found.
 * @returns The next visible sibling element, if one exists.
 */
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

const getDefaultAction = (ev: KeyboardEvent): RovingAction | undefined => {
    switch (ev.key) {
        case "Home":
            return RovingAction.Home;
        case "End":
            return RovingAction.End;
        case "ArrowLeft":
            return RovingAction.ArrowLeft;
        case "ArrowUp":
            return RovingAction.ArrowUp;
        case "ArrowRight":
            return RovingAction.ArrowRight;
        case "ArrowDown":
            return RovingAction.ArrowDown;
        case "Tab":
            return RovingAction.Tab;
        default:
            return undefined;
    }
};

/**
 * Provides shared roving tabindex state and keyboard handling for a group of
 * focusable descendants.
 */
export const RovingTabIndexProvider: React.FC<RovingTabIndexProviderProps> = ({
    children,
    handleHomeEnd,
    handleUpDown,
    handleLeftRight,
    handleLoop,
    handleInputFields,
    scrollIntoView,
    onKeyDown,
    getAction = getDefaultAction,
}) => {
    const [state, dispatch] = useReducer(reducer, {
        nodes: [],
    });

    const context = useMemo<IContext>(() => ({ state, dispatch }), [state]);

    const onKeyDownHandler = useCallback(
        (ev: KeyboardEvent) => {
            if (onKeyDown) {
                onKeyDown(ev, context.state, context.dispatch);
                if (ev.defaultPrevented) {
                    return;
                }
            }

            let handled = false;
            const action = getAction(ev);
            let focusNode: HTMLElement | undefined;
            // Don't interfere with input default keydown behaviour
            // but allow people to move focus from it with Tab.
            if (!handleInputFields && checkInputableElement(ev.target as HTMLElement)) {
                switch (action) {
                    case RovingAction.Tab:
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
                switch (action) {
                    case RovingAction.Home:
                        if (handleHomeEnd) {
                            handled = true;
                            focusNode = findSiblingElement(context.state.nodes, 0);
                        }
                        break;

                    case RovingAction.End:
                        if (handleHomeEnd) {
                            handled = true;
                            focusNode = findSiblingElement(context.state.nodes, context.state.nodes.length - 1, true);
                        }
                        break;

                    case RovingAction.ArrowDown:
                    case RovingAction.ArrowRight:
                        if (
                            (action === RovingAction.ArrowDown && handleUpDown) ||
                            (action === RovingAction.ArrowRight && handleLeftRight)
                        ) {
                            handled = true;
                            if (context.state.nodes.length > 0) {
                                const idx = context.state.nodes.indexOf(context.state.activeNode!);
                                focusNode = findSiblingElement(context.state.nodes, idx + 1, false, handleLoop);
                            }
                        }
                        break;

                    case RovingAction.ArrowUp:
                    case RovingAction.ArrowLeft:
                        if (
                            (action === RovingAction.ArrowUp && handleUpDown) ||
                            (action === RovingAction.ArrowLeft && handleLeftRight)
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
                focusNode.focus();
                // programmatic focus doesn't fire the onFocus handler, so we must do the do ourselves
                dispatch({
                    type: RovingStateActionType.SetFocus,
                    payload: {
                        node: focusNode,
                    },
                });
                if (scrollIntoView) {
                    focusNode.scrollIntoView(scrollIntoView);
                }
            }
        },
        [
            context,
            getAction,
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
            type: RovingStateActionType.Update,
        });
    }, []);

    return (
        <RovingTabIndexContext.Provider value={context}>
            {children({ onKeyDownHandler, onDragEndHandler })}
        </RovingTabIndexContext.Provider>
    );
};

/**
 * Registers a focusable element with the nearest
 * {@link RovingTabIndexContext}.
 *
 * @param inputRef - Optional ref to reuse for the registered DOM node.
 * @returns A tuple containing:
 * `onFocus` to mark the item active,
 * `isActive` to drive `tabIndex`,
 * `ref` to register the DOM node,
 * and `nodeRef` pointing at the registered node.
 */
export const useRovingTabIndex = <T extends HTMLElement>(
    inputRef?: RefObject<T | null>,
): [() => void, boolean, RefCallback<T>, RefObject<T | null>] => {
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
                type: RovingStateActionType.Register,
                payload: { node },
            });
        } else {
            context.dispatch({
                type: RovingStateActionType.Unregister,
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
            type: RovingStateActionType.SetFocus,
            payload: { node: nodeRef.current },
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // eslint-disable-next-line react-compiler/react-compiler
    const isActive = context.state.activeNode === nodeRef.current;
    return [onFocus, isActive, ref, nodeRef];
};
