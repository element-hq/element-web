/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import Sizer from "../sizer";
import FixedDistributor from "./fixed";
import { type IConfig } from "../resizer";

class PercentageSizer extends Sizer {
    public start(item: HTMLElement): void {
        if (this.vertical) {
            item.style.minHeight = "";
        } else {
            item.style.minWidth = "";
        }
    }

    public finish(item: HTMLElement): void {
        const parent = item.offsetParent as HTMLElement;
        if (!parent) return;
        if (this.vertical) {
            const p = ((item.offsetHeight / parent.offsetHeight) * 100).toFixed(2) + "%";
            item.style.minHeight = p;
            item.style.height = p;
        } else {
            const p = ((item.offsetWidth / parent.offsetWidth) * 100).toFixed(2) + "%";
            item.style.minWidth = p;
            item.style.width = p;
        }
    }
}

export default class PercentageDistributor extends FixedDistributor<IConfig> {
    public static createSizer(containerElement: HTMLElement, vertical: boolean, reverse: boolean): PercentageSizer {
        return new PercentageSizer(containerElement, vertical, reverse);
    }
}
