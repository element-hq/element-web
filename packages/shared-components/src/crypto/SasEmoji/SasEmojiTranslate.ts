/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import SasEmojiJson from "@matrix-org/spec/sas-emoji.json";
import { getNormalizedLanguageKeys } from "matrix-web-i18n";

// Type as specified in https://spec.matrix.org/v1.17/client-server-api/#sas-method-emoji
export type SasEmoji =
    | "🐶"
    | "🐱"
    | "🦁"
    | "🐎"
    | "🦄"
    | "🐷"
    | "🐘"
    | "🐰"
    | "🐼"
    | "🐓"
    | "🐧"
    | "🐢"
    | "🐟"
    | "🐙"
    | "🦋"
    | "🌷"
    | "🌳"
    | "🌵"
    | "🍄"
    | "🌏"
    | "🌙"
    | "☁"
    | "🔥"
    | "🍌"
    | "🍎"
    | "🍓"
    | "🌽"
    | "🍕"
    | "🎂"
    | "❤"
    | "😀"
    | "🤖"
    | "🎩"
    | "👓"
    | "🔧"
    | "🎅"
    | "👍"
    | "☂"
    | "⌛"
    | "⏰"
    | "🎁"
    | "💡"
    | "📕"
    | "✏"
    | "📎"
    | "✂"
    | "🔒"
    | "🔑"
    | "🔨"
    | "☎"
    | "🏁"
    | "🚂"
    | "🚲"
    | "✈"
    | "🚀"
    | "🏆"
    | "⚽"
    | "🎸"
    | "🎺"
    | "🔔"
    | "⚓"
    | "🎧"
    | "📁"
    | "📌";

const SasEmojiMap = new Map<
    SasEmoji,
    [
        description: string,
        translations: {
            [normalizedLanguageKey: string]: string;
        },
    ]
>(
    SasEmojiJson.map(({ emoji, description, translated_descriptions: translations }) => [
        emoji as SasEmoji,
        [
            description,
            // Normalize the translation keys
            Object.keys(translations).reduce<Record<string, string>>((o, k) => {
                for (const key of getNormalizedLanguageKeys(k)) {
                    o[key] = translations[k as keyof typeof translations]!;
                }
                return o;
            }, {}),
        ],
    ]),
);

/**
 * Translate given SAS emoji into the target locale
 * @param emoji - the SAS emoji to translate
 * @param locale - the BCP 47 locale to translate to, will fall back to English as the base locale for Matrix SAS Emoji.
 */
export function tEmoji(emoji: SasEmoji, locale: string): string {
    const mapping = SasEmojiMap.get(emoji);
    if (!mapping) {
        throw new Error(`Emoji mapping not found for emoji ${emoji}`);
    }

    const [description, translations] = mapping;

    for (const key of getNormalizedLanguageKeys(locale)) {
        if (translations[key]) {
            return translations[key];
        }
    }

    return description;
}
