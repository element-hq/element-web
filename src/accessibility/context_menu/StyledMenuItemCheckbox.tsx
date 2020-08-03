/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {Key} from "../../Keyboard";
import StyledCheckbox from "../../components/views/elements/StyledCheckbox";

interface IProps extends React.ComponentProps<typeof StyledCheckbox> {
    label?: string;
    onChange(); // we handle keyup/down ourselves so lose the ChangeEvent
    onClose(): void; // gets called after onChange on Key.ENTER
}

// Semantic component for representing a styled role=menuitemcheckbox
export const StyledMenuItemCheckbox: React.FC<IProps> = ({children, label, onChange, onClose, ...props}) => {
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === Key.ENTER || e.key === Key.SPACE) {
            e.stopPropagation();
            e.preventDefault();
            onChange();
            // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
            if (e.key === Key.ENTER) {
                onClose();
            }
        }
    };
    const onKeyUp = (e: React.KeyboardEvent) => {
        // prevent the input default handler as we handle it on keydown to match
        // https://www.w3.org/TR/wai-aria-practices/examples/menubar/menubar-2/menubar-2.html
        if (e.key === Key.SPACE || e.key === Key.ENTER) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    return (
        <StyledCheckbox
            {...props}
            role="menuitemcheckbox"
            tabIndex={-1}
            aria-label={label}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
        >
            { children }
        </StyledCheckbox>
    );
};
