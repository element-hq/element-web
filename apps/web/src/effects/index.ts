/*
Copyright 2024 New Vector Ltd.
Copyright 2020 Nurjin Jafar
Copyright 2020 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t, _td } from "../languageHandler";
import { type Effect } from "./effect.ts";

/**
 * This configuration defines room effects that can be triggered by custom message types and emojis
 */
export const CHAT_EFFECTS: Array<Effect> = [
    {
        emojis: ["🎊", "🎉"],
        msgType: "nic.custom.confetti",
        command: "confetti",
        description: () => _td("chat_effects|confetti_description"),
        fallbackMessage: () => _t("chat_effects|confetti_message") + " 🎉",
        getRenderer: async () => {
            const { default: Effect } = await import("./confetti/index.ts");
            return new Effect({
                maxCount: 150,
                speed: 3,
                frameInterval: 15,
                alpha: 1.0,
                gradient: false,
            });
        },
    },
    {
        emojis: ["🎆"],
        msgType: "nic.custom.fireworks",
        command: "fireworks",
        description: () => _td("chat_effects|fireworks_description"),
        fallbackMessage: () => _t("chat_effects|fireworks_message") + " 🎆",
        getRenderer: async () => {
            const { default: Effect } = await import("./fireworks/index.ts");
            return new Effect({
                maxCount: 500,
                gravity: 0.05,
            });
        },
    },
    {
        emojis: ["🌧️", "⛈️", "🌦️"],
        msgType: "io.element.effect.rainfall",
        command: "rainfall",
        description: () => _td("chat_effects|rainfall_description"),
        fallbackMessage: () => _t("chat_effects|rainfall_message") + " 🌧️",
        getRenderer: async () => {
            const { default: Effect } = await import("./rainfall/index.ts");
            return new Effect({
                maxCount: 600,
                speed: 10,
            });
        },
    },
    {
        emojis: ["❄", "🌨"],
        msgType: "io.element.effect.snowfall",
        command: "snowfall",
        description: () => _td("chat_effects|snowfall_description"),
        fallbackMessage: () => _t("chat_effects|snowfall_message") + " ❄",
        getRenderer: async () => {
            const { default: Effect } = await import("./snowfall/index.ts");
            return new Effect({
                maxCount: 200,
                gravity: 0.05,
                maxDrift: 5,
            });
        },
    },
    {
        emojis: ["👾", "🌌"],
        msgType: "io.element.effects.space_invaders",
        command: "spaceinvaders",
        description: () => _td("chat_effects|spaceinvaders_description"),
        fallbackMessage: () => _t("chat_effects|spaceinvaders_message") + " 👾",
        getRenderer: async () => {
            const { default: Effect } = await import("./spaceinvaders/index.ts");
            return new Effect({
                maxCount: 50,
                gravity: 0.01,
            });
        },
    },
    {
        emojis: ["💝"],
        msgType: "io.element.effect.hearts",
        command: "hearts",
        description: () => _td("chat_effects|hearts_description"),
        fallbackMessage: () => _t("chat_effects|hearts_message") + " 💝",
        getRenderer: async () => {
            const { default: Effect } = await import("./hearts/index.ts");
            return new Effect({
                maxCount: 120,
                gravity: 3.2,
            });
        },
    },
];
