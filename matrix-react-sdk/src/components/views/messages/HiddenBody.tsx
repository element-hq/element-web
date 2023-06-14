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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import { IBodyProps } from "./IBodyProps";

interface IProps {
    mxEvent: MatrixEvent;
}

/**
 * A message hidden from the user pending moderation.
 *
 * Note: This component must not be used when the user is the author of the message
 * or has a sufficient powerlevel to see the message.
 */
const HiddenBody = React.forwardRef<any, IProps | IBodyProps>(({ mxEvent }, ref) => {
    let text;
    const visibility = mxEvent.messageVisibility();
    switch (visibility.visible) {
        case true:
            throw new Error("HiddenBody should only be applied to hidden messages");
        case false:
            if (visibility.reason) {
                text = _t("Message pending moderation: %(reason)s", { reason: visibility.reason });
            } else {
                text = _t("Message pending moderation");
            }
            break;
    }

    return (
        <span className="mx_HiddenBody" ref={ref}>
            {text}
        </span>
    );
});

export default HiddenBody;
