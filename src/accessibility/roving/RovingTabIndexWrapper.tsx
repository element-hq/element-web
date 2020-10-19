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

import React from "react";

import {useRovingTabIndex} from "../RovingTabIndex";
import {FocusHandler, Ref} from "./types";

interface IProps {
    inputRef?: Ref;
    children(renderProps: {
        onFocus: FocusHandler;
        isActive: boolean;
        ref: Ref;
    });
}

// Wrapper to allow use of useRovingTabIndex outside of React Functional Components.
export const RovingTabIndexWrapper: React.FC<IProps> = ({children, inputRef}) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return children({onFocus, isActive, ref});
};
