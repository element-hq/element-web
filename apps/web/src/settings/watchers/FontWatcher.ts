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
        if (payload.action === Action.UpdateFontSizeDelta) {
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
