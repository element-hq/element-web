/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX } from "react";

import AppTile from "../elements/AppTile";
import { ElementCallAppTile } from "./ElementCallAppTile";
import { useSettingValue } from "../../../hooks/useSettings";

type AppTileProps = ComponentProps<typeof AppTile>;
/**
 * The props `AppTile` fills in from `defaultProps`, plus the ones its callers already omit (`AppTile`'s
 * `defaultProps` is typed as `Partial`, which makes every prop optional at the call site); optional here too.
 */
type DefaultedAppTileProps =
    | "userId"
    | "creatorUserId"
    | "waitForIframeLoad"
    | "showMenubar"
    | "showTitle"
    | "showPopout"
    | "handleMinimisePointerEvents"
    | "userWidget"
    | "miniMode"
    | "threadId"
    | "showLayoutButtons";

/** The props of `AppTile`, with its `defaultProps` applied, so that `CallTile` is a drop-in replacement. */
export type CallTileProps = Omit<AppTileProps, DefaultedAppTileProps> &
    Partial<Pick<AppTileProps, DefaultedAppTileProps>>;

/**
 * Renders the tile for an Element Call widget, choosing the transport: the in-process React component
 * when `feature_element_call_react` is enabled, otherwise the usual `AppTile` iframe.
 *
 * This is the single place that decides between the two paths. Callers are responsible for only using
 * it for Element Call widgets (`WidgetType.CALL`); see `PersistentApp` for the generic case.
 */
export const CallTile = (props: CallTileProps): JSX.Element => {
    const reactCall = useSettingValue("feature_element_call_react");
    return reactCall ? <ElementCallAppTile {...props} /> : <AppTile {...props} />;
};
