/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import dis from "../../dispatcher/dispatcher";
import SettingsStore from "../SettingsStore";
import IWatcher from "./Watcher";
import { toPx } from "../../utils/units";
import { Action } from "../../dispatcher/actions";
import { SettingLevel } from "../SettingLevel";
import { UpdateSystemFontPayload } from "../../dispatcher/payloads/UpdateSystemFontPayload";
import { ActionPayload } from "../../dispatcher/payloads";

export class FontWatcher implements IWatcher {
    public static readonly MIN_SIZE = 8;
    public static readonly DEFAULT_SIZE = 10;
    public static readonly MAX_SIZE = 15;
    // Externally we tell the user the font is size 15. Internally we use 10.
    public static readonly SIZE_DIFF = 5;

    private dispatcherRef: string | null;

    public constructor() {
        this.dispatcherRef = null;
    }

    public start(): void {
        this.updateFont();
        this.dispatcherRef = dis.register(this.onAction);
    }

    public stop(): void {
        if (!this.dispatcherRef) return;
        dis.unregister(this.dispatcherRef);
    }

    private updateFont(): void {
        this.setRootFontSize(SettingsStore.getValue("baseFontSize"));
        this.setSystemFont({
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            font: SettingsStore.getValue("systemFont"),
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.UpdateFontSize) {
            this.setRootFontSize(payload.size);
        } else if (payload.action === Action.UpdateSystemFont) {
            this.setSystemFont(payload as UpdateSystemFontPayload);
        } else if (payload.action === Action.OnLoggedOut) {
            // Clear font overrides when logging out
            this.setRootFontSize(FontWatcher.DEFAULT_SIZE);
            this.setSystemFont({
                useSystemFont: false,
                font: "",
            });
        } else if (payload.action === Action.OnLoggedIn) {
            // Font size can be saved on the account, so grab value when logging in
            this.updateFont();
        }
    };

    private setRootFontSize = (size: number): void => {
        const fontSize = Math.max(Math.min(FontWatcher.MAX_SIZE, size), FontWatcher.MIN_SIZE);

        if (fontSize !== size) {
            SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, fontSize);
        }
        document.querySelector<HTMLElement>(":root")!.style.fontSize = toPx(fontSize);
    };

    private setSystemFont = ({
        useSystemFont,
        font,
    }: Pick<UpdateSystemFontPayload, "useSystemFont" | "font">): void => {
        if (useSystemFont) {
            // Make sure that fonts with spaces in their names get interpreted properly
            document.body.style.fontFamily = font
                .split(",")
                .map((font) => {
                    font = font.trim();
                    if (!font.startsWith('"') && !font.endsWith('"')) {
                        font = `"${font}"`;
                    }
                    return font;
                })
                .join(",");
        } else {
            document.body.style.fontFamily = "";
        }
    };
}
