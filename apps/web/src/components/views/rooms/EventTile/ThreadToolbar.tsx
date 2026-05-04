/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { ActionBarView } from "@element-hq/web-shared-components";

import type { ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";

type ThreadToolbarProps = {
    vm: ThreadListActionBarViewModel;
};

export function ThreadToolbar({ vm }: Readonly<ThreadToolbarProps>): JSX.Element {
    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}
