/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from 'react';

import { useCombinedRefs } from "../../../hooks/useCombinedRefs";

interface IProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onInput'> {
    onChange?: (event: Event) => void;
    onInput?: (event: Event) => void;
}

/**
* This component restores the native 'onChange' and 'onInput' behavior of
* JavaScript which have important differences for certain <input> types. This is
* necessary because in React, the `onChange` handler behaves like the native
* `oninput` handler and there is no way to tell the difference between an
* `input` vs `change` event.
*
* via https://stackoverflow.com/a/62383569/796832 and
* https://github.com/facebook/react/issues/9657#issuecomment-643970199
*
* See:
* - https://reactjs.org/docs/dom-elements.html#onchange
* - https://github.com/facebook/react/issues/3964
* - https://github.com/facebook/react/issues/9657
* - https://github.com/facebook/react/issues/14857
*
* Examples:
*
* We use this for the <input type="date"> date picker so we can distinguish from
* a final date picker selection (onChange) vs navigating the months in the date
* picker (onInput).
*
* This is also potentially useful for <input type="range" /> because the native
* events behave in such a way that moving the slider around triggers an onInput
* event and releasing it triggers onChange.
*/
const NativeOnChangeInput: React.FC<IProps> = React.forwardRef((props: IProps, ref) => {
    const registerCallbacks = (input: HTMLInputElement | null) => {
        if (input) {
            input.onchange = props.onChange;
            input.oninput = props.onInput;
        }
    };

    return <input
        ref={useCombinedRefs(registerCallbacks, ref)}
        {...props}
        // These are just here so we don't get a read-only input warning from React
        onChange={() => {}}
        onInput={() => {}}
    />;
});

export default NativeOnChangeInput;
