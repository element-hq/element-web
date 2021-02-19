/*
 Copyright 2020 Nurjin Jafar
 Copyright 2020 Nordeck IT + Consulting GmbH.

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
import { _t, _td } from "../languageHandler";

export type Effect<TOptions extends { [key: string]: any }> = {
    /**
     * one or more emojis that will trigger this effect
     */
    emojis: Array<string>;
    /**
     * the matrix message type that will trigger this effect
     */
    msgType: string;
    /**
     * the room command to trigger this effect
     */
    command: string;
    /**
     * a function that returns the translated description of the effect
     */
    description: () => string;
    /**
     * a function that returns the translated fallback message. this message will be shown if the user did not provide a custom message
     */
    fallbackMessage: () => string;
    /**
     * animation options
     */
    options: TOptions;
}

type ConfettiOptions = {
    /**
     * max confetti count
     */
    maxCount: number;
    /**
     * particle animation speed
     */
    speed: number;
    /**
     * the confetti animation frame interval in milliseconds
     */
    frameInterval: number;
    /**
     * the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
     */
    alpha: number;
    /**
     * use gradient instead of solid particle color
     */
    gradient: boolean;
};
type FireworksOptions = {
    /**
     * max fireworks count
     */
    maxCount: number;
    /**
     * gravity value that firework adds to shift from it's start position
     */
    gravity: number;
}
type SnowfallOptions = {
    /**
     * The maximum number of snowflakes to render at a given time
     */
    maxCount: number;
    /**
     * The amount of gravity to apply to the snowflakes
     */
    gravity: number;
    /**
     * The amount of drift (horizontal sway) to apply to the snowflakes. Each snowflake varies.
     */
    maxDrift: number;
}

/**
 * This configuration defines room effects that can be triggered by custom message types and emojis
 */
export const CHAT_EFFECTS: Array<Effect<{ [key: string]: any }>> = [
    {
        emojis: ['🎊', '🎉'],
        msgType: 'nic.custom.confetti',
        command: 'confetti',
        description: () => _td("Sends the given message with confetti"),
        fallbackMessage: () => _t("sends confetti") + " 🎉",
        options: {
            maxCount: 150,
            speed: 3,
            frameInterval: 15,
            alpha: 1.0,
            gradient: false,
        },
    } as Effect<ConfettiOptions>,
    {
        emojis: ['🎆'],
        msgType: 'nic.custom.fireworks',
        command: 'fireworks',
        description: () => _td("Sends the given message with fireworks"),
        fallbackMessage: () => _t("sends fireworks") + " 🎆",
        options: {
            maxCount: 500,
            gravity: 0.05,
        },
    } as Effect<FireworksOptions>,
    {
        emojis: ['❄', '🌨'],
        msgType: 'io.element.effect.snowfall',
        command: 'snowfall',
        description: () => _td("Sends the given message with snowfall"),
        fallbackMessage: () => _t("sends snowfall") + " ❄",
        options: {
            maxCount: 200,
            gravity: 0.05,
            maxDrift: 5,
        },
    } as Effect<SnowfallOptions>,
];


