/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JSX } from "react";

/**
 * Any kind of event that can trigger a button
 * @alpha
 */
export type ButtonEvent = React.MouseEvent<Element> | React.KeyboardEvent<Element> | React.FormEvent<Element>;

/**
 * The type of the function used to render a space panel item.
 * @alpha
 */
export interface SpacePanelItemProps {
    spaceKey?: string;
    className?: string;
    icon?: JSX.Element;
    label: string;
    contextMenuTooltip?: string;
    style?: React.CSSProperties;
    //notificationState?: NotificationState;
    onClick?(ev?: ButtonEvent): void;
}

/**
 * API for inserting extra UI into Element Web.
 * @alpha Subject to change.
 */
export interface ExtrasApi {
    addSpacePanelItem(props: SpacePanelItemProps): void;
}
