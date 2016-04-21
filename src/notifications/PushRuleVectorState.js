/*
Copyright 2016 OpenMarket Ltd

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

var StandardActions = require('./StandardActions');
var NotificationUtils = require('./NotificationUtils');

var states = {
    /** The push rule is disabled */
    OFF: "off",

    /** The user will receive push notification for this rule */
    ON: "on",

    /** The user will receive push notification for this rule with sound and
        highlight if this is legitimate */
    LOUD: "loud",
};


module.exports = {
    /**
     * Enum for state of a push rule as defined by the Vector UI.
     * @readonly
     * @enum {string}
     */
    states: states,

    /**
     * Convert a PushRuleVectorState to a list of actions
     *
     * @return [object] list of push-rule actions
     */
    actionsFor: function(pushRuleVectorState) {
        if (pushRuleVectorState === this.ON) {
            return StandardActions.ACTION_NOTIFY;
        }
        else if (pushRuleVectorState === this.LOUD) {
            return StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND;
        }
    },

    /**
     * Convert a pushrule's actions to a PushRuleVectorState.
     *
     * Determines whether a content rule is in the PushRuleVectorState.ON
     * category or in PushRuleVectorState.LOUD, regardless of its enabled
     * state. Returns null if it does not match these categories.
     */
    contentRuleVectorStateKind: function(rule) {
        var decoded = NotificationUtils.decodeActions(rule.actions);

        if (!decoded) {
            return null;
        }

        // Count tweaks to determine if it is a ON or LOUD rule
        var tweaks = 0;
        if (decoded.sound) {
            tweaks++;
        }
        if (decoded.highlight) {
            tweaks++;
        }
        var stateKind = null;
        switch (tweaks) {
            case 0:
                stateKind = this.ON;
                break;
            case 2:
                stateKind = this.LOUD;
                break;
        }
        return stateKind;
    },
};

for (var k in states) {
    module.exports[k] = states[k];
};
