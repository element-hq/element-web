/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SettingLevel } from "../SettingLevel";
import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";

export default class WebEventIndexController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string | null,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        // Web 端默认强制开启本地消息搜索（IndexedDB），避免用户还需要去设置页手动打开。
        // 其它平台保持原行为（允许用户关闭）。
        if (PlatformPeg.get()?.getHumanReadableName() === "Web Platform") return true;
        return null;
    }
}
