/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type UIComponent } from "../../settings/UIFeature";
import { ComponentVisibilityCustomisations } from "../ComponentVisibility";

export function shouldShowComponent(component: UIComponent): boolean {
    return ComponentVisibilityCustomisations.shouldShowComponent?.(component) ?? true;
}
