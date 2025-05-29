/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IWidget } from "matrix-widget-api";

export interface IApp extends IWidget {
    "roomId": string;
    "eventId"?: string; // not present on virtual widgets
    // eslint-disable-next-line camelcase
    "avatar_url"?: string; // MSC2765 https://github.com/matrix-org/matrix-doc/pull/2765
    // Whether the widget was created from `widget_build_url` and thus is a call widget of some kind
    "io.element.managed_hybrid"?: boolean;
}

export interface IWidgetEvent {
    id: string;
    type: string;
    sender: string;
    // eslint-disable-next-line camelcase
    state_key: string;
    content: IApp;
}

export interface UserWidget extends Omit<IWidgetEvent, "content"> {
    content: IWidget & Partial<IApp>;
}
