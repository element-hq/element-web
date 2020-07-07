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
    RefObject,
    Dispatch,
} from "react";

import {Key} from "../Keyboard";
import AccessibleButton from "../components/views/elements/AccessibleButton";

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

const DOCUMENT_POSITION_PRECEDING = 2;

type Ref = RefObject<HTMLElement>;

interface IState {
    activeRef: Ref;
    refs: Ref[];
}

interface IContext {
    state: IState;
    dispatch: Dispatch<IAction>;
}

const RovingTabIndexContext = createContext<IContext>({
    state: {
        activeRef: null,
        refs: [], // list of refs in DOM order
    },
    dispatch: () => {},
});
RovingTabIndexContext.displayName = "RovingTabIndexContext";

enum Type {
    Register = "REGISTER",
    Unregister = "UNREGISTER",
    SetFocus = "SET_FOCUS",
}

interface IAction {
    type: Type;
    payload: {
        ref: Ref;
    };
}

const reducer = (state: IState, action: IAction) => {
    switch (action.type) {
        case Type.Register: {
            if (state.refs.length === 0) {
                // Our list of refs was empty, set activeRef to this first item
                return {
                    ...state,
                    activeRef: action.payload.ref,
                    refs: [action.payload.ref],
                };
            }

            if (state.refs.includes(action.payload.ref)) {
                return state; // already in refs, this should not happen
            }

            // find the index of the first ref which is not preceding this one in DOM order
            let newIndex = state.refs.findIndex(ref => {
                return ref.current.compareDocumentPosition(action.payload.ref.current) & DOCUMENT_POSITION_PRECEDING;
            });

            if (newIndex < 0) {
                newIndex = state.refs.length; // append to the end
            }

            // update the refs list
            return {
                ...state,
                refs: [
                    ...state.refs.slice(0, newIndex),
                    action.payload.ref,
                    ...state.refs.slice(newIndex),
                ],
            };
        }
        case Type.Unregister: {
            // filter out the ref which we are removing
            const refs = state.refs.filter(r => r !== action.payload.ref);

            if (refs.length === state.refs.length) {
                return state; // already removed, this should not happen
            }

            if (state.activeRef === action.payload.ref) {
                // we just removed the active ref, need to replace it
                // pick the ref which is now in the index the old ref was in
                const oldIndex = state.refs.findIndex(r => r === action.payload.ref);
                return {
                    ...state,
                    activeRef: oldIndex >= refs.length ? refs[refs.length - 1] : refs[oldIndex],
                    refs,
                };
            }

            // update the refs list
            return {
                ...state,
                refs,
            };
        }
        case Type.SetFocus: {
            // update active ref
            return {
                ...state,
                activeRef: action.payload.ref,
            };
        }
        default:
            return state;
    }
};

interface IProps {
    handleHomeEnd?: boolean;
    children(renderProps: {
        onKeyDownHandler(ev: React.KeyboardEvent);
    });
    onKeyDown?(ev: React.KeyboardEvent);
}

export const RovingTabIndexProvider: React.FC<IProps> = ({children, handleHomeEnd, onKeyDown}) => {
    const [state, dispatch] = useReducer<Reducer<IState, IAction>>(reducer, {
        activeRef: null,
        refs: [],
    });

    const context = useMemo<IContext>(() => ({state, dispatch}), [state]);

    const onKeyDownHandler = useCallback((ev) => {
        let handled = false;
        if (handleHomeEnd) {
            // check if we actually have any items
            switch (ev.key) {
                case Key.HOME:
                    handled = true;
                    // move focus to first item
                    if (context.state.refs.length > 0) {
                        context.state.refs[0].current.focus();
                    }
                    break;
                case Key.END:
                    handled = true;
                    // move focus to last item
                    if (context.state.refs.length > 0) {
                        context.state.refs[context.state.refs.length - 1].current.focus();
                    }
                    break;
            }
        }

        if (handled) {
            ev.preventDefault();
            ev.stopPropagation();
        } else if (onKeyDown) {
            return onKeyDown(ev);
        }
    }, [context.state, onKeyDown, handleHomeEnd]);

    return <RovingTabIndexContext.Provider value={context}>
        { children({onKeyDownHandler}) }
    </RovingTabIndexContext.Provider>;
};

type FocusHandler = () => void;

// Hook to register a roving tab index
// inputRef parameter specifies the ref to use
// onFocus should be called when the index gained focus in any manner
// isActive should be used to set tabIndex in a manner such as `tabIndex={isActive ? 0 : -1}`
// ref should be passed to a DOM node which will be used for DOM compareDocumentPosition
export const useRovingTabIndex = (inputRef: Ref): [FocusHandler, boolean, Ref] => {
    const context = useContext(RovingTabIndexContext);
    let ref = useRef<HTMLElement>(null);

    if (inputRef) {
        // if we are given a ref, use it instead of ours
        ref = inputRef;
    }

    // setup (after refs)
    useLayoutEffect(() => {
        context.dispatch({
            type: Type.Register,
            payload: {ref},
        });
        // teardown
        return () => {
            context.dispatch({
                type: Type.Unregister,
                payload: {ref},
            });
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onFocus = useCallback(() => {
        context.dispatch({
            type: Type.SetFocus,
            payload: {ref},
        });
    }, [ref, context]);

    const isActive = context.state.activeRef === ref;
    return [onFocus, isActive, ref];
};

interface IRovingTabIndexWrapperProps {
    inputRef?: Ref;
    children(renderProps: {
        onFocus: FocusHandler;
        isActive: boolean;
        ref: Ref;
    });
}

// Wrapper to allow use of useRovingTabIndex outside of React Functional Components.
export const RovingTabIndexWrapper: React.FC<IRovingTabIndexWrapperProps> = ({children, inputRef}) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return children({onFocus, isActive, ref});
};

interface IRovingAccessibleButtonProps extends React.ComponentProps<typeof AccessibleButton> {
    inputRef?: Ref;
}

// Wrapper to allow use of useRovingTabIndex for simple AccessibleButtons outside of React Functional Components.
export const RovingAccessibleButton: React.FC<IRovingAccessibleButtonProps> = ({inputRef, ...props}) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return <AccessibleButton {...props} onFocus={onFocus} inputRef={ref} tabIndex={isActive ? 0 : -1} />;
};

