/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type PushRuleAction,
    PushRuleActionName,
    type TweakHighlight,
    type TweakSound,
} from "matrix-js-sdk/src/matrix";

export interface PushRuleActions {
    notify: boolean;
    sound?: string;
    highlight?: boolean;
}

export class NotificationUtils {
    // Encodes a dictionary of {
    //   "notify": true/false,
    //   "sound": string or undefined,
    //   "highlight: true/false,
    // }
    // to a list of push actions.
    public static encodeActions(action: PushRuleActions): PushRuleAction[] {
        const notify = action.notify;
        const sound = action.sound;
        const highlight = action.highlight;
        if (notify) {
            const actions: PushRuleAction[] = [PushRuleActionName.Notify];
            if (sound) {
                actions.push({ set_tweak: "sound", value: sound } as TweakSound);
            }
            if (highlight) {
                actions.push({ set_tweak: "highlight" } as TweakHighlight);
            } else {
                actions.push({ set_tweak: "highlight", value: false } as TweakHighlight);
            }
            return actions;
        } else {
            return [PushRuleActionName.DontNotify];
        }
    }

    // Decode a list of actions to a dictionary of {
    //   "notify": true/false,
    //   "sound": string or undefined,
    //   "highlight: true/false,
    // }
    // If the actions couldn't be decoded then returns null.
    public static decodeActions(actions: PushRuleAction[]): PushRuleActions | null {
        let notify = false;
        let sound: string | undefined;
        let highlight: boolean | undefined = false;

        for (const action of actions) {
            if (action === PushRuleActionName.Notify) {
                notify = true;
            } else if (action === PushRuleActionName.DontNotify) {
                notify = false;
            } else if (typeof action === "object") {
                if (action.set_tweak === "sound") {
                    sound = action.value;
                } else if (action.set_tweak === "highlight") {
                    highlight = action.value;
                } else {
                    // We don't understand this kind of tweak, so give up.
                    return null;
                }
            } else {
                // We don't understand this kind of action, so give up.
                return null;
            }
        }

        if (highlight === undefined) {
            // If a highlight tweak is missing a value then it defaults to true.
            highlight = true;
        }

        const result: PushRuleActions = { notify, highlight };
        if (sound !== undefined) {
            result.sound = sound;
        }
        return result;
    }
}
