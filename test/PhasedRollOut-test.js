/*
Copyright 2018 New Vector Ltd
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

import {phasedRollOutExpiredForUser} from '../src/PhasedRollOut';

const OFFSET = 6000000;
// phasedRollOutExpiredForUser enables users in bucks of 1 minute
const MS_IN_MINUTE = 60 * 1000;

describe('PhasedRollOut', function() {
    it('should return true if phased rollout is not configured', function() {
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test", 0, null)).toBeTruthy();
    });

    it('should return true if phased rollout feature is not configured', function() {
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test", 0, {
            "feature_other": {offset: 0, period: 0},
        })).toBeTruthy();
    });

    it('should return false if phased rollout for feature is misconfigured', function() {
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test", 0, {
            "feature_test": {},
        })).toBeFalsy();
    });

    it("should return false if phased rollout hasn't started yet", function() {
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test", 5000000, {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE},
        })).toBeFalsy();
    });

    it("should start to return true in bucket 2/10 for '@user:hs'", function() {
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test",
            OFFSET + (MS_IN_MINUTE * 2) - 1, {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE * 10},
        })).toBeFalsy();
        expect(phasedRollOutExpiredForUser("@user:hs", "feature_test",
            OFFSET + (MS_IN_MINUTE * 2), {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE * 10},
        })).toBeTruthy();
    });

    it("should start to return true in bucket 4/10 for 'alice@other-hs'", function() {
        expect(phasedRollOutExpiredForUser("alice@other-hs", "feature_test",
            OFFSET + (MS_IN_MINUTE * 4) - 1, {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE * 10},
        })).toBeFalsy();
        expect(phasedRollOutExpiredForUser("alice@other-hs", "feature_test",
            OFFSET + (MS_IN_MINUTE * 4), {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE * 10},
        })).toBeTruthy();
    });

    it("should return true after complete rollout period'", function() {
        expect(phasedRollOutExpiredForUser("user:hs", "feature_test",
            OFFSET + (MS_IN_MINUTE * 20), {
            "feature_test": {offset: OFFSET, period: MS_IN_MINUTE * 10},
        })).toBeTruthy();
    });
});
