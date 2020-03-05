/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import SettingController from "./SettingController";
import {DEFAULT_THEME, enumerateThemes} from "../../theme";

export default class ThemeController extends SettingController {
    static isLogin = false;

    getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
        if (!calculatedValue) return null; // Don't override null themes

        if (ThemeController.isLogin) return 'light';

        const themes = enumerateThemes();
        // Override in case some no longer supported theme is stored here
        if (!themes[calculatedValue]) {
            return DEFAULT_THEME;
        }

        return null; // no override
    }
}
