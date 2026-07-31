/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

export const SPARK_APPEARANCE_ACCOUNT_DATA = "in.cinny.appearance_settings";
const STORAGE_KEY = "element.spark.appearance.v1";

export type SparkInterfaceStyle = "classic" | "frosted";

export interface SparkAppearanceSettings {
    interfaceStyle: SparkInterfaceStyle;
    accentColor: string;
    accentOpacity: number;
    ownBubbleColor: string;
    ownBubbleOpacity: number;
    otherBubbleColor: string;
    otherBubbleOpacity: number;
    chatBackgroundDataUrl?: string;
}

export const DEFAULT_SPARK_APPEARANCE: SparkAppearanceSettings = {
    interfaceStyle: "classic",
    accentColor: "#008c72",
    accentOpacity: 100,
    ownBubbleColor: "#e3f6ed",
    ownBubbleOpacity: 100,
    otherBubbleColor: "#f5f5f4",
    otherBubbleOpacity: 100,
};

const clampOpacity = (value: unknown, fallback: number): number => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number)
        ? Math.max(0, Math.min(100, Math.round(number)))
        : fallback;
};

const validHex = (value: unknown, fallback: string): string =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : fallback;

export const normaliseSparkAppearance = (
    value: unknown
): SparkAppearanceSettings => {
    const candidate =
        value && typeof value === "object"
            ? (value as Partial<SparkAppearanceSettings>)
            : {};
    return {
        interfaceStyle:
            candidate.interfaceStyle === "frosted" ? "frosted" : "classic",
        accentColor: validHex(
            candidate.accentColor,
            DEFAULT_SPARK_APPEARANCE.accentColor
        ),
        accentOpacity: clampOpacity(
            candidate.accentOpacity,
            DEFAULT_SPARK_APPEARANCE.accentOpacity
        ),
        ownBubbleColor: validHex(
            candidate.ownBubbleColor,
            DEFAULT_SPARK_APPEARANCE.ownBubbleColor
        ),
        ownBubbleOpacity: clampOpacity(
            candidate.ownBubbleOpacity,
            DEFAULT_SPARK_APPEARANCE.ownBubbleOpacity
        ),
        otherBubbleColor: validHex(
            candidate.otherBubbleColor,
            DEFAULT_SPARK_APPEARANCE.otherBubbleColor
        ),
        otherBubbleOpacity: clampOpacity(
            candidate.otherBubbleOpacity,
            DEFAULT_SPARK_APPEARANCE.otherBubbleOpacity
        ),
        chatBackgroundDataUrl:
            typeof candidate.chatBackgroundDataUrl === "string" &&
            candidate.chatBackgroundDataUrl.startsWith("data:image/")
                ? candidate.chatBackgroundDataUrl
                : undefined,
    };
};

const hexToRgba = (hex: string, opacity: number): string => {
    const value = hex.slice(1);
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgb(${red} ${green} ${blue} / ${opacity / 100})`;
};

export const applySparkAppearance = (
    settings: SparkAppearanceSettings
): void => {
    const root = document.documentElement;
    root.dataset.sparkInterfaceStyle = settings.interfaceStyle;
    root.dataset.sparkAppearance = "true";
    root.style.setProperty(
        "--spark-accent",
        hexToRgba(settings.accentColor, settings.accentOpacity)
    );
    root.style.setProperty(
        "--spark-bubble-self-bg",
        hexToRgba(settings.ownBubbleColor, settings.ownBubbleOpacity)
    );
    root.style.setProperty(
        "--spark-bubble-other-bg",
        hexToRgba(settings.otherBubbleColor, settings.otherBubbleOpacity)
    );
    root.style.setProperty(
        "--spark-chat-background-image",
        settings.chatBackgroundDataUrl
            ? `url("${settings.chatBackgroundDataUrl}")`
            : "none"
    );
};

export const loadStoredSparkAppearance = (): SparkAppearanceSettings => {
    try {
        return normaliseSparkAppearance(
            JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
        );
    } catch {
        return DEFAULT_SPARK_APPEARANCE;
    }
};

export const hasStoredSparkAppearance = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
        return false;
    }
};

export const saveStoredSparkAppearance = (
    settings: SparkAppearanceSettings
): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applySparkAppearance(settings);
};

// The settings dialog is bundled with the main application. Apply the locally
// stored appearance as soon as that module is evaluated so a reload does not
// briefly flash the default room background.
if (typeof window !== "undefined") {
    applySparkAppearance(loadStoredSparkAppearance());
}
