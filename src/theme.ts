/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { compare } from "matrix-js-sdk/src/utils";

import { _t } from "./languageHandler";
import SettingsStore from "./settings/SettingsStore";
import ThemeWatcher from "./settings/watchers/ThemeWatcher";

export const DEFAULT_THEME = "light";
const HIGH_CONTRAST_THEMES: Record<string, string> = {
    light: "light-high-contrast",
};

interface IFontFaces extends Omit<Record<(typeof allowedFontFaceProps)[number], string>, "src"> {
    src: {
        format: string;
        url: string;
        local: string;
    }[];
}

interface ICustomTheme {
    colors: {
        [key: string]: string;
    };
    fonts: {
        faces: IFontFaces[];
        general: string;
        monospace: string;
    };
    is_dark?: boolean; // eslint-disable-line camelcase
}

/**
 * Given a non-high-contrast theme, find the corresponding high-contrast one
 * if it exists, or return undefined if not.
 */
export function findHighContrastTheme(theme: string): string | undefined {
    return HIGH_CONTRAST_THEMES[theme];
}

/**
 * Given a high-contrast theme, find the corresponding non-high-contrast one
 * if it exists, or return undefined if not.
 */
export function findNonHighContrastTheme(hcTheme: string): string | undefined {
    for (const theme in HIGH_CONTRAST_THEMES) {
        if (HIGH_CONTRAST_THEMES[theme] === hcTheme) {
            return theme;
        }
    }
}

/**
 * Decide whether the supplied theme is high contrast.
 */
export function isHighContrastTheme(theme: string): boolean {
    return Object.values(HIGH_CONTRAST_THEMES).includes(theme);
}

export function enumerateThemes(): { [key: string]: string } {
    const BUILTIN_THEMES = {
        "light": _t("Light"),
        "light-high-contrast": _t("Light high contrast"),
        "dark": _t("Dark"),
    };
    const customThemes = SettingsStore.getValue("custom_themes");
    const customThemeNames: Record<string, string> = {};
    for (const { name } of customThemes) {
        customThemeNames[`custom-${name}`] = name;
    }
    return Object.assign({}, customThemeNames, BUILTIN_THEMES);
}

interface ITheme {
    id: string;
    name: string;
}

export function getOrderedThemes(): ITheme[] {
    const themes = Object.entries(enumerateThemes())
        .map((p) => ({ id: p[0], name: p[1] })) // convert pairs to objects for code readability
        .filter((p) => !isHighContrastTheme(p.id));
    const builtInThemes = themes.filter((p) => !p.id.startsWith("custom-"));
    const customThemes = themes.filter((p) => !builtInThemes.includes(p)).sort((a, b) => compare(a.name, b.name));
    return [...builtInThemes, ...customThemes];
}

function clearCustomTheme(): void {
    // remove all css variables, we assume these are there because of the custom theme
    const inlineStyleProps = Object.values(document.body.style);
    for (const prop of inlineStyleProps) {
        if (prop.startsWith("--")) {
            document.body.style.removeProperty(prop);
        }
    }
    const customFontFaceStyle = document.querySelector("head > style[title='custom-theme-font-faces']");
    if (customFontFaceStyle) {
        customFontFaceStyle.remove();
    }
}

const allowedFontFaceProps = [
    "font-display",
    "font-family",
    "font-stretch",
    "font-style",
    "font-weight",
    "font-variant",
    "font-feature-settings",
    "font-variation-settings",
    "src",
    "unicode-range",
] as const;

function generateCustomFontFaceCSS(faces: IFontFaces[]): string {
    return faces
        .map((face) => {
            const src = face.src
                ?.map((srcElement) => {
                    let format = "";
                    if (srcElement.format) {
                        format = `format("${srcElement.format}")`;
                    }
                    if (srcElement.url) {
                        return `url("${srcElement.url}") ${format}`;
                    } else if (srcElement.local) {
                        return `local("${srcElement.local}") ${format}`;
                    }
                    return "";
                })
                .join(", ");
            const props = Object.keys(face).filter((prop) =>
                allowedFontFaceProps.includes(prop as (typeof allowedFontFaceProps)[number]),
            ) as Array<(typeof allowedFontFaceProps)[number]>;
            const body = props
                .map((prop) => {
                    let value: string;
                    if (prop === "src") {
                        value = src;
                    } else if (prop === "font-family") {
                        value = `"${face[prop]}"`;
                    } else {
                        value = face[prop];
                    }
                    return `${prop}: ${value}`;
                })
                .join(";");
            return `@font-face {${body}}`;
        })
        .join("\n");
}

function setCustomThemeVars(customTheme: ICustomTheme): void {
    const { style } = document.body;

    function setCSSColorVariable(name: string, hexColor: string, doPct = true): void {
        style.setProperty(`--${name}`, hexColor);
        if (doPct) {
            // uses #rrggbbaa to define the color with alpha values at 0%, 15% and 50%
            style.setProperty(`--${name}-0pct`, hexColor + "00");
            style.setProperty(`--${name}-15pct`, hexColor + "26");
            style.setProperty(`--${name}-50pct`, hexColor + "7F");
        }
    }

    if (customTheme.colors) {
        for (const [name, value] of Object.entries(customTheme.colors)) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i += 1) {
                    setCSSColorVariable(`${name}_${i}`, value[i], false);
                }
            } else {
                setCSSColorVariable(name, value);
            }
        }
    }
    if (customTheme.fonts) {
        const { fonts } = customTheme;
        if (fonts.faces) {
            const css = generateCustomFontFaceCSS(fonts.faces);
            const style = document.createElement("style");
            style.setAttribute("title", "custom-theme-font-faces");
            style.setAttribute("type", "text/css");
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        }
        if (fonts.general) {
            style.setProperty("--font-family", fonts.general);
        }
        if (fonts.monospace) {
            style.setProperty("--font-family-monospace", fonts.monospace);
        }
    }
}

export function getCustomTheme(themeName: string): ICustomTheme {
    // set css variables
    const customThemes = SettingsStore.getValue("custom_themes");
    if (!customThemes) {
        throw new Error(`No custom themes set, can't set custom theme "${themeName}"`);
    }
    const customTheme = customThemes.find((t: ITheme) => t.name === themeName);
    if (!customTheme) {
        const knownNames = customThemes.map((t: ITheme) => t.name).join(", ");
        throw new Error(`Can't find custom theme "${themeName}", only know ${knownNames}`);
    }
    return customTheme;
}

/**
 * Called whenever someone changes the theme
 * Async function that returns once the theme has been set
 * (ie. the CSS has been loaded)
 *
 * @param {string} theme new theme
 */
export async function setTheme(theme?: string): Promise<void> {
    if (!theme) {
        const themeWatcher = new ThemeWatcher();
        theme = themeWatcher.getEffectiveTheme();
    }
    clearCustomTheme();
    let stylesheetName = theme;
    if (theme.startsWith("custom-")) {
        const customTheme = getCustomTheme(theme.slice(7));
        stylesheetName = customTheme.is_dark ? "dark-custom" : "light-custom";
        setCustomThemeVars(customTheme);
    }

    // look for the stylesheet elements.
    // styleElements is a map from style name to HTMLLinkElement.
    const styleElements = new Map<string, HTMLLinkElement>();
    const themes = Array.from(document.querySelectorAll<HTMLLinkElement>("[data-mx-theme]"));
    themes.forEach((theme) => {
        styleElements.set(theme.dataset.mxTheme!.toLowerCase(), theme);
    });

    if (!styleElements.has(stylesheetName)) {
        throw new Error("Unknown theme " + stylesheetName);
    }

    // disable all of them first, then enable the one we want. Chrome only
    // bothers to do an update on a true->false transition, so this ensures
    // that we get exactly one update, at the right time.
    //
    // ^ This comment was true when we used to use alternative stylesheets
    // for the CSS.  Nowadays we just set them all as disabled in index.html
    // and enable them as needed.  It might be cleaner to disable them all
    // at the same time to prevent loading two themes simultaneously and
    // having them interact badly... but this causes a flash of unstyled app
    // which is even uglier.  So we don't.

    const styleSheet = styleElements.get(stylesheetName)!;
    styleSheet.disabled = false;

    return new Promise((resolve, reject) => {
        const switchTheme = function (): void {
            // we re-enable our theme here just in case we raced with another
            // theme set request as per https://github.com/vector-im/element-web/issues/5601.
            // We could alternatively lock or similar to stop the race, but
            // this is probably good enough for now.
            styleSheet.disabled = false;
            styleElements.forEach((a) => {
                if (a == styleSheet) return;
                a.disabled = true;
            });
            const bodyStyles = global.getComputedStyle(document.body);
            if (bodyStyles.backgroundColor) {
                const metaElement = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
                metaElement.content = bodyStyles.backgroundColor;
            }
            resolve();
        };

        const isStyleSheetLoaded = (): boolean =>
            Boolean([...document.styleSheets].find((_styleSheet) => _styleSheet?.href === styleSheet.href));

        function waitForStyleSheetLoading(): void {
            // turns out that Firefox preloads the CSS for link elements with
            // the disabled attribute, but Chrome doesn't.
            if (isStyleSheetLoaded()) {
                switchTheme();
                return;
            }

            let counter = 0;

            // In case of theme toggling (white => black => white)
            // Chrome doesn't fire the `load` event when the white theme is selected the second times
            const intervalId = window.setInterval(() => {
                if (isStyleSheetLoaded()) {
                    clearInterval(intervalId);
                    styleSheet.onload = null;
                    styleSheet.onerror = null;
                    switchTheme();
                }

                // Avoid to be stuck in an endless loop if there is an issue in the stylesheet loading
                counter++;
                if (counter === 10) {
                    clearInterval(intervalId);
                    reject();
                }
            }, 200);

            styleSheet.onload = () => {
                clearInterval(intervalId);
                switchTheme();
            };

            styleSheet.onerror = (e) => {
                clearInterval(intervalId);
                reject(e);
            };
        }

        waitForStyleSheetLoading();
    });
}
