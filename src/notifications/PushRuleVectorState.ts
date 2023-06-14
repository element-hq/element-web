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

import { IPushRule, PushRuleAction } from "matrix-js-sdk/src/@types/PushRules";

import { StandardActions } from "./StandardActions";
import { NotificationUtils } from "./NotificationUtils";

export enum VectorState {
    /** The push rule is disabled */
    Off = "off",
    /** The user will receive push notification for this rule */
    On = "on",
    /** The user will receive push notification for this rule with sound and
     highlight if this is legitimate */
    Loud = "loud",
}

export class PushRuleVectorState {
    // Backwards compatibility (things should probably be using the enum above instead)
    public static OFF = VectorState.Off;
    public static ON = VectorState.On;
    public static LOUD = VectorState.Loud;

    /**
     * Enum for state of a push rule as defined by the Vector UI.
     * @readonly
     * @enum {string}
     */
    public static states = VectorState;

    /**
     * Convert a PushRuleVectorState to a list of actions
     *
     * @return [object] list of push-rule actions
     */
    public static actionsFor(pushRuleVectorState?: VectorState): PushRuleAction[] {
        if (pushRuleVectorState === VectorState.On) {
            return StandardActions.ACTION_NOTIFY;
        } else if (pushRuleVectorState === VectorState.Loud) {
            return StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND;
        }
        return [];
    }

    /**
     * Convert a pushrule's actions to a PushRuleVectorState.
     *
     * Determines whether a content rule is in the PushRuleVectorState.ON
     * category or in PushRuleVectorState.LOUD, regardless of its enabled
     * state. Returns null if it does not match these categories.
     */
    public static contentRuleVectorStateKind(rule: IPushRule): VectorState | null {
        const decoded = NotificationUtils.decodeActions(rule.actions);

        if (!decoded) {
            return null;
        }

        // Count tweaks to determine if it is a ON or LOUD rule
        let tweaks = 0;
        if (decoded.sound) {
            tweaks++;
        }
        if (decoded.highlight) {
            tweaks++;
        }
        let stateKind: VectorState | null = null;
        switch (tweaks) {
            case 0:
                stateKind = VectorState.On;
                break;
            case 2:
                stateKind = VectorState.Loud;
                break;
        }
        return stateKind;
    }
}
