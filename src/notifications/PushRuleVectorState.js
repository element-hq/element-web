/*
Copyright 2016 OpenMarket Ltd
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

'use strict';

import {StandardActions} from "./StandardActions";
import {NotificationUtils} from "./NotificationUtils";

export class PushRuleVectorState {
    // Backwards compatibility (things should probably be using .states instead)
    static OFF = "off";
    static ON = "on";
    static LOUD = "loud";

    /**
     * Enum for state of a push rule as defined by the Vector UI.
     * @readonly
     * @enum {string}
     */
    static states = {
        /** The push rule is disabled */
        OFF: PushRuleVectorState.OFF,

        /** The user will receive push notification for this rule */
        ON: PushRuleVectorState.ON,

        /** The user will receive push notification for this rule with sound and
         highlight if this is legitimate */
        LOUD: PushRuleVectorState.LOUD,
    };

    /**
     * Convert a PushRuleVectorState to a list of actions
     *
     * @return [object] list of push-rule actions
     */
    static actionsFor(pushRuleVectorState) {
        if (pushRuleVectorState === PushRuleVectorState.ON) {
            return StandardActions.ACTION_NOTIFY;
        } else if (pushRuleVectorState === PushRuleVectorState.LOUD) {
            return StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND;
        }
    }

    /**
     * Convert a pushrule's actions to a PushRuleVectorState.
     *
     * Determines whether a content rule is in the PushRuleVectorState.ON
     * category or in PushRuleVectorState.LOUD, regardless of its enabled
     * state. Returns null if it does not match these categories.
     */
    static contentRuleVectorStateKind(rule) {
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
        let stateKind = null;
        switch (tweaks) {
            case 0:
                stateKind = PushRuleVectorState.ON;
                break;
            case 2:
                stateKind = PushRuleVectorState.LOUD;
                break;
        }
        return stateKind;
    }
}
