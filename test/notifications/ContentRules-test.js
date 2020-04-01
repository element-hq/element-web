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

var notifications = require('../../src/notifications');

var ContentRules = notifications.ContentRules;
var PushRuleVectorState = notifications.PushRuleVectorState;

var expect = require('expect');
var test_utils = require('../test-utils');

var NORMAL_RULE = {
    actions: [
        "notify",
        { set_tweak: "highlight", value: false },
    ],
    enabled: true,
    pattern: "vdh2",
    rule_id: "vdh2",
};

var LOUD_RULE = {
    actions: [
        "notify",
        { set_tweak: "highlight" },
        { set_tweak: "sound", value: "default" },
    ],
    enabled: true,
    pattern: "vdh2",
    rule_id: "vdh2",
};

var USERNAME_RULE = {
    actions: [
        "notify",
        { set_tweak: "sound", value: "default" },
        { set_tweak: "highlight" },
    ],
    default: true,
    enabled: true,
    pattern: "richvdh",
    rule_id: ".m.rule.contains_user_name",
};



describe("ContentRules", function() {
    describe("parseContentRules", function() {
        it("should handle there being no keyword rules", function() {
            var rules = { 'global': { 'content': [
                    USERNAME_RULE,
            ]}};
            var parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules).toEqual([]);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.ON);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse regular keyword notifications", function() {
            var rules = { 'global': { 'content': [
                NORMAL_RULE,
                USERNAME_RULE,
            ]}};

            var parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(NORMAL_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.ON);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse loud keyword notifications", function() {
            var rules = { 'global': { 'content': [
                LOUD_RULE,
                USERNAME_RULE,
            ]}};

            var parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(LOUD_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.LOUD);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse mixed keyword notifications", function() {
            var rules = { 'global': { 'content': [
                LOUD_RULE,
                NORMAL_RULE,
                USERNAME_RULE,
            ]}};

            var parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(LOUD_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.LOUD);
            expect(parsed.externalRules.length).toEqual(1);
            expect(parsed.externalRules[0]).toEqual(NORMAL_RULE);
        });
    });
});
