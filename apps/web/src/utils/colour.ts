/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { split } from "lodash";

export function textToHtmlRainbow(str: string): string {
    const frequency = (2 * Math.PI) / str.length;

    return split(str, "")
        .map((c, i) => {
            if (c === " ") {
                return c;
            }
            const [a, b] = generateAB(i * frequency, 1);
            const [red, green, blue] = labToRGB(75, a, b);
            return (
                '<span data-mx-color="#' +
                red.toString(16).padStart(2, "0") +
                green.toString(16).padStart(2, "0") +
                blue.toString(16).padStart(2, "0") +
                '">' +
                c +
                "</span>"
            );
        })
        .join("");
}

function generateAB(hue: number, chroma: number): [number, number] {
    const a = chroma * 127 * Math.cos(hue);
    const b = chroma * 127 * Math.sin(hue);

    return [a, b];
}

function labToRGB(l: number, a: number, b: number): [number, number, number] {
    // https://en.wikipedia.org/wiki/CIELAB_color_space#Reverse_transformation
    // https://en.wikipedia.org/wiki/SRGB#The_forward_transformation_(CIE_XYZ_to_sRGB)

    // Convert CIELAB to CIEXYZ (D65)
    let y = (l + 16) / 116;
    const x = adjustXYZ(y + a / 500) * 0.9505;
    const z = adjustXYZ(y - b / 200) * 1.089;

    y = adjustXYZ(y);

    // Linear transformation from CIEXYZ to RGB
    const red = 3.24096994 * x - 1.53738318 * y - 0.49861076 * z;
    const green = -0.96924364 * x + 1.8759675 * y + 0.04155506 * z;
    const blue = 0.05563008 * x - 0.20397696 * y + 1.05697151 * z;

    return [adjustRGB(red), adjustRGB(green), adjustRGB(blue)];
}

function adjustXYZ(v: number): number {
    if (v > 0.2069) {
        return Math.pow(v, 3);
    }
    return 0.1284 * v - 0.01771;
}

function gammaCorrection(v: number): number {
    // Non-linear transformation to sRGB
    if (v <= 0.0031308) {
        return 12.92 * v;
    }
    return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function adjustRGB(v: number): number {
    const corrected = gammaCorrection(v);

    // Limits number between 0 and 1
    const limited = Math.min(Math.max(corrected, 0), 1);

    return Math.round(limited * 255);
}
