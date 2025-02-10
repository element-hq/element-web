/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import dis from "../../dispatcher/dispatcher";
import SettingsStore from "../SettingsStore";
import type IWatcher from "./Watcher";
import { toPx } from "../../utils/units";
import { Action } from "../../dispatcher/actions";
import { SettingLevel } from "../SettingLevel";
import { type UpdateSystemFontPayload } from "../../dispatcher/payloads/UpdateSystemFontPayload";
import { type ActionPayload } from "../../dispatcher/payloads";

export class FontWatcher implements IWatcher {
    /**
     * This Compound value is using `100%` of the default browser font size.
     * It allows EW to use the browser's default font size instead of a fixed value.
     * All the Compound font size are using `rem`, they are relative to the root font size
     * and therefore of the browser font size.
     */
    private static readonly DEFAULT_SIZE = "var(--cpd-font-size-root)";
    /**
     * Default delta added to the ${@link DEFAULT_SIZE}
     */
    public static readonly DEFAULT_DELTA = 0;

    private dispatcherRef?: string;

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
     * Migrate the base font size from the V1 and V2 version to the V3 version
     * @private
     */
    private async migrateBaseFontSize(): Promise<void> {
        await this.migrateBaseFontV1toFontSizeDelta();
        await this.migrateBaseFontV2toFontSizeDelta();
    }

    /**
     * Migrating from the V1 version of the base font size to the new delta system.
     * The delta system is using the default browser font size as a base
     * Everything will become slightly larger, and getting rid of the `SIZE_DIFF`
     * weirdness for locally persisted values
     * @private
     */
    private async migrateBaseFontV1toFontSizeDelta(): Promise<void> {
        const legacyBaseFontSize = SettingsStore.getValue("baseFontSize");
        // No baseFontV1 found, nothing to migrate
        if (!legacyBaseFontSize) return;

        console.log(
            "Migrating base font size -> base font size V2 -> font size delta for Compound, current value",
            legacyBaseFontSize,
        );

        // Compute the V1 to V2 version before migrating to fontSizeDelta
        const baseFontSizeV2 = this.computeBaseFontSizeV1toV2(legacyBaseFontSize);

        // Compute the difference between the V2 and the fontSizeDelta
        const delta = this.computeFontSizeDeltaFromV2BaseFontSize(baseFontSizeV2);

        await SettingsStore.setValue("fontSizeDelta", null, SettingLevel.DEVICE, delta);
        await SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, 0);
        console.log("Migration complete, deleting legacy `baseFontSize`");
    }

    /**
     * Migrating from the V2 version of the base font size to the new delta system
     * @private
     */
    private async migrateBaseFontV2toFontSizeDelta(): Promise<void> {
        const legacyBaseFontV2Size = SettingsStore.getValue("baseFontSizeV2");
        // No baseFontV2 found, nothing to migrate
        if (!legacyBaseFontV2Size) return;

        console.log("Migrating base font size V2 for Compound, current value", legacyBaseFontV2Size);

        // Compute the difference between the V2 and the fontSizeDelta
        const delta = this.computeFontSizeDeltaFromV2BaseFontSize(legacyBaseFontV2Size);

        await SettingsStore.setValue("fontSizeDelta", null, SettingLevel.DEVICE, delta);
        await SettingsStore.setValue("baseFontSizeV2", null, SettingLevel.DEVICE, 0);
        console.log("Migration complete, deleting legacy `baseFontSizeV2`");
    }

    /**
     * Compute the V2 font size from the V1 font size
     * @param legacyBaseFontSize
     * @private
     */
    private computeBaseFontSizeV1toV2(legacyBaseFontSize: number): number {
        // For some odd reason, the persisted value in user storage has an offset
        // of 5 pixels for all values stored under `baseFontSize`
        const LEGACY_SIZE_DIFF = 5;

        // Compound uses a base font size of `16px`, whereas the old Element
        // styles based their calculations off a `15px` root font size.
        const ROOT_FONT_SIZE_INCREASE = 1;

        // Compute the font size of the V2 version before migrating to V3
        return legacyBaseFontSize + ROOT_FONT_SIZE_INCREASE + LEGACY_SIZE_DIFF;
    }

    /**
     * Compute the difference between the V2 font size and the default browser font size
     * @param legacyBaseFontV2Size
     * @private
     */
    private computeFontSizeDeltaFromV2BaseFontSize(legacyBaseFontV2Size: number): number {
        const browserDefaultFontSize = FontWatcher.getRootFontSize();

        // Compute the difference between the V2 font size and the default browser font size
        return legacyBaseFontV2Size - browserDefaultFontSize;
    }

    /**
     * Get the root font size of the document
     * Fallback to 16px if the value is not found
     * @returns {number}
     */
    public static getRootFontSize(): number {
        return parseInt(window.getComputedStyle(document.documentElement).getPropertyValue("font-size"), 10) || 16;
    }

    /**
     * Get the browser default font size
     * @returns {number} the default font size of the browser
     */
    public static getBrowserDefaultFontSize(): number {
        return this.getRootFontSize() - SettingsStore.getValue("fontSizeDelta");
    }

    public stop(): void {
        dis.unregister(this.dispatcherRef);
    }

    private updateFont(): void {
        this.setRootFontSize(SettingsStore.getValue("fontSizeDelta"));
        this.setSystemFont({
            useBundledEmojiFont: SettingsStore.getValue("useBundledEmojiFont"),
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            font: SettingsStore.getValue("systemFont"),
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.MigrateBaseFontSize) {
            this.migrateBaseFontSize();
        } else if (payload.action === Action.UpdateFontSizeDelta) {
            this.setRootFontSize(payload.delta);
        } else if (payload.action === Action.UpdateSystemFont) {
            this.setSystemFont(payload as UpdateSystemFontPayload);
        } else if (payload.action === Action.OnLoggedOut) {
            // Clear font overrides when logging out
            this.setRootFontSize(FontWatcher.DEFAULT_DELTA);
            this.setSystemFont({
                useBundledEmojiFont: false,
                useSystemFont: false,
                font: "",
            });
        } else if (payload.action === Action.OnLoggedIn) {
            // Font size can be saved on the account, so grab value when logging in
            this.updateFont();
        }
    };

    /**
     * Set the root font size of the document
     * @param delta {number} the delta to add to the default font size
     */
    private setRootFontSize = async (delta: number): Promise<void> => {
        // Add the delta to the browser default font size
        document.querySelector<HTMLElement>(":root")!.style.fontSize =
            `calc(${FontWatcher.DEFAULT_SIZE} + ${toPx(delta)})`;
    };

    public static readonly FONT_FAMILY_CUSTOM_PROPERTY = "--cpd-font-family-sans";
    public static readonly EMOJI_FONT_FAMILY_CUSTOM_PROPERTY = "--emoji-font-family";
    public static readonly BUNDLED_EMOJI_FONT = "Twemoji";

    private setSystemFont = ({
        useBundledEmojiFont,
        useSystemFont,
        font,
    }: Pick<UpdateSystemFontPayload, "useBundledEmojiFont" | "useSystemFont" | "font">): void => {
        if (useSystemFont) {
            let fontString = font
                .split(",")
                .map((font) => {
                    font = font.trim();
                    if (!font.startsWith('"') && !font.endsWith('"')) {
                        font = `"${font}"`;
                    }
                    return font;
                })
                .join(",");

            if (useBundledEmojiFont) {
                fontString += ", " + FontWatcher.BUNDLED_EMOJI_FONT;
            }

            /**
             * Overrides the default font family from Compound
             * Make sure that fonts with spaces in their names get interpreted properly
             */
            document.body.style.setProperty(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY, fontString);
        } else {
            document.body.style.removeProperty(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY);

            if (useBundledEmojiFont) {
                document.body.style.setProperty(
                    FontWatcher.EMOJI_FONT_FAMILY_CUSTOM_PROPERTY,
                    FontWatcher.BUNDLED_EMOJI_FONT,
                );
            } else {
                document.body.style.removeProperty(FontWatcher.EMOJI_FONT_FAMILY_CUSTOM_PROPERTY);
            }
        }
    };
}
