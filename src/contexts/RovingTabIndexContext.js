/*
 *
 * Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useReducer,
} from "react";
import PropTypes from "prop-types";
import {Key} from "../Keyboard";

const DOCUMENT_POSITION_PRECEDING = 2;
const ANY = Symbol();

const RovingTabIndexContext = createContext({
    state: {
        activeRef: null,
        refs: [],
    },
    dispatch: () => {},
});
RovingTabIndexContext.displayName = "RovingTabIndexContext";

// TODO use a TypeScript type here
const types = {
    REGISTER: "REGISTER",
    UNREGISTER: "UNREGISTER",
    SET_FOCUS: "SET_FOCUS",
};

const reducer = (state, action) => {
    switch (action.type) {
        case types.REGISTER: {
            if (state.refs.length === 0) {
                return {
                    ...state,
                    activeRef: action.payload.ref,
                    refs: [action.payload.ref],
                };
            }

            if (state.refs.includes(action.payload.ref)) {
                return state; // already in refs, this should not happen
            }

            let newIndex = state.refs.findIndex(ref => {
                return ref.current.compareDocumentPosition(action.payload.ref.current) & DOCUMENT_POSITION_PRECEDING;
            });

            if (newIndex < 0) {
                newIndex = state.refs.length; // append to the end
            }

            return {
                ...state,
                refs: [
                    ...state.refs.slice(0, newIndex),
                    action.payload.ref,
                    ...state.refs.slice(newIndex),
                ],
            };
        }
        case types.UNREGISTER: {
            const refs = state.refs.filter(r => r !== action.payload.ref); // keep all other refs

            if (refs.length === state.refs.length) {
                return state; // already removed, this should not happen
            }

            if (state.activeRef === action.payload.ref) { // we just removed the active ref, need to replace it
                const oldIndex = state.refs.findIndex(r => r === action.payload.ref);
                return {
                    ...state,
                    activeRef: oldIndex >= refs.length ? refs[refs.length - 1] : refs[oldIndex],
                    refs,
                };
            }

            return {
                ...state,
                refs,
            };
        }
        case types.SET_FOCUS: {
            return {
                ...state,
                activeRef: action.payload.ref,
            };
        }
        default:
            return state;
    }
};

export const RovingTabIndexContextWrapper = ({children}) => {
    const [state, dispatch] = useReducer(reducer, {
        activeRef: null,
        refs: [],
    });

    const context = useMemo(() => ({state, dispatch}), [state]);

    return <RovingTabIndexContext.Provider value={context}>
        {children}
    </RovingTabIndexContext.Provider>;
};

export const useRovingTabIndex = () => {
    const ref = useRef(null);
    const context = useContext(RovingTabIndexContext);

    // setup/teardown
    // add ref to the context
    useLayoutEffect(() => {
        context.dispatch({
            type: types.REGISTER,
            payload: {ref},
        });
        return () => {
            context.dispatch({
                type: types.UNREGISTER,
                payload: {ref},
            });
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onFocus = useCallback(() => {
        context.dispatch({
            type: types.SET_FOCUS,
            payload: {ref},
        });
    }, [ref, context]);
    const isActive = context.state.activeRef === ref || context.state.activeRef === ANY;
    return [onFocus, isActive, ref];
};

export const RovingTabIndexGroup = ({children}) => {
    const [onFocus, isActive, ref] = useRovingTabIndex();

    // fake reducer dispatch to catch SET_FOCUS calls and pass them to parent as a focus of the group
    const dispatch = useCallback(({type}) => {
        if (type === types.SET_FOCUS) {
            onFocus();
        }
    }, [onFocus]);

    const context = useMemo(() => ({
        state: {activeRef: isActive ? ANY : undefined},
        dispatch,
    }), [isActive, dispatch]);

    return <div ref={ref}>
        <RovingTabIndexContext.Provider value={context}>
            {children}
        </RovingTabIndexContext.Provider>
    </div>;
};

// Wraps a given element to attach it to the roving context, props onFocus and tabIndex overridden
export const RovingTabIndex = ({component: E, useInputRef, ...props}) => {
    const [onFocus, isActive, ref] = useRovingTabIndex();
    const refProps = {};
    if (useInputRef) {
        refProps.inputRef = ref;
    } else {
        refProps.ref = ref;
    }
    return <E {...props} {...refProps} onFocus={onFocus} tabIndex={isActive ? 0 : -1} />;
};
RovingTabIndex.propTypes = {
    component: PropTypes.elementType.isRequired,
    useInputRef: PropTypes.bool, // whether to pass inputRef instead of ref like for AccessibleButton
};

