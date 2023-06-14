/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import { PushRuleAction, PushRuleActionName, TweakHighlight, TweakSound } from "matrix-js-sdk/src/@types/PushRules";

interface IEncodedActions {
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
    public static encodeActions(action: IEncodedActions): PushRuleAction[] {
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
    public static decodeActions(actions: PushRuleAction[]): IEncodedActions | null {
        let notify = false;
        let sound: string | undefined;
        let highlight: boolean | undefined = false;

        for (let i = 0; i < actions.length; ++i) {
            const action = actions[i];
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

        const result: IEncodedActions = { notify, highlight };
        if (sound !== undefined) {
            result.sound = sound;
        }
        return result;
    }
}
