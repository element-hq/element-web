/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import RoomContext from "../../../contexts/RoomContext";
import * as TextForEvent from "../../../TextForEvent";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    mxEvent: MatrixEvent;
}

export default class TextualEvent extends React.Component<IProps> {
    public static contextType = RoomContext;
    public declare context: React.ContextType<typeof RoomContext>;

    public render(): React.ReactNode {
        const text = TextForEvent.textForEvent(
            this.props.mxEvent,
            MatrixClientPeg.safeGet(),
            true,
            this.context?.showHiddenEvents,
        );
        if (!text) return null;
        return <div className="mx_TextualEvent">{text}</div>;
    }
}
