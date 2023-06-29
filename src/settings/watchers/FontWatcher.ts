/*
Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.

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
import { clamp } from "../../utils/numbers";

export class FontWatcher implements IWatcher {
    /**
     * Value indirectly defined by Compound.
     * All `rem` calculations are made from a `16px` values in the
     * @vector-im/compound-design-tokens package
     *
     * We might want to move to using `100%` instead so we can inherit the user
     * preference set in the browser regarding font sizes.
     */
    public static readonly DEFAULT_SIZE = 16;
    public static readonly MIN_SIZE = FontWatcher.DEFAULT_SIZE - 5;
    public static readonly MAX_SIZE = FontWatcher.DEFAULT_SIZE + 5;

    private dispatcherRef: string | null;

    public constructor() {
        this.dispatcherRef = null;
    }

    public async start(): Promise<void> {
        this.updateFont();
        this.dispatcherRef = dis.register(this.onAction);
        /**
         * baseFontSize is an account level setting which is loaded after the initial
         * sync. Hence why we can't do that in the `constructor`
         */
        await this.migrateBaseFontSize();
    }

    /**
     * Migrating the old `baseFontSize` for Compound.
     * Everything will becomes slightly larger, and getting rid of the `SIZE_DIFF`
     * weirdness for locally persisted values
     */
    private async migrateBaseFontSize(): Promise<void> {
        const legacyBaseFontSize = SettingsStore.getValue("baseFontSize");
        if (legacyBaseFontSize) {
            console.log("Migrating base font size for Compound, current value", legacyBaseFontSize);

            // For some odd reason, the persisted value in user storage has an offset
            // of 5 pixels for all values stored under `baseFontSize`
            const LEGACY_SIZE_DIFF = 5;
            // Compound uses a base font size of `16px`, whereas the old Element
            // styles based their calculations off a `15px` root font size.
            const ROOT_FONT_SIZE_INCREASE = 1;

            const baseFontSize = legacyBaseFontSize + ROOT_FONT_SIZE_INCREASE + LEGACY_SIZE_DIFF;

            await SettingsStore.setValue("baseFontSizeV2", null, SettingLevel.DEVICE, baseFontSize);
            await SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, "");
            console.log("Migration complete, deleting legacy `baseFontSize`");
        }
    }

    public stop(): void {
        if (!this.dispatcherRef) return;
        dis.unregister(this.dispatcherRef);
    }

    private updateFont(): void {
        this.setRootFontSize(SettingsStore.getValue("baseFontSizeV2"));
        this.setSystemFont({
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            font: SettingsStore.getValue("systemFont"),
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.MigrateBaseFontSize) {
            this.migrateBaseFontSize();
        } else if (payload.action === Action.UpdateFontSize) {
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

    private setRootFontSize = async (size: number): Promise<void> => {
        const fontSize = clamp(size, FontWatcher.MIN_SIZE, FontWatcher.MAX_SIZE);

        if (fontSize !== size) {
            await SettingsStore.setValue("baseFontSizeV2", null, SettingLevel.DEVICE, fontSize);
        }
        document.querySelector<HTMLElement>(":root")!.style.fontSize = toPx(fontSize);
    };

    public static readonly FONT_FAMILY_CUSTOM_PROPERTY = "--cpd-font-family-sans";

    private setSystemFont = ({
        useSystemFont,
        font,
    }: Pick<UpdateSystemFontPayload, "useSystemFont" | "font">): void => {
        if (useSystemFont) {
            /**
             * Overrides the default font family from Compound
             * Make sure that fonts with spaces in their names get interpreted properly
             */
            document.body.style.setProperty(
                FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY,
                font
                    .split(",")
                    .map((font) => {
                        font = font.trim();
                        if (!font.startsWith('"') && !font.endsWith('"')) {
                            font = `"${font}"`;
                        }
                        return font;
                    })
                    .join(","),
            );
        } else {
            document.body.style.removeProperty(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY);
        }
    };
}
