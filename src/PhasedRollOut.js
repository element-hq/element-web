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

import SdkConfig from './SdkConfig';
import {hashCode} from './utils/FormattingUtils';

export function phasedRollOutExpiredForUser(username, feature, now, rollOutConfig = SdkConfig.get().phasedRollOut) {
    if (!rollOutConfig) {
        console.log(`no phased rollout configuration, so enabling ${feature}`);
        return true;
    }
    const featureConfig = rollOutConfig[feature];
    if (!featureConfig) {
        console.log(`${feature} doesn't have phased rollout configured, so enabling`);
        return true;
    }
    if (!Number.isFinite(featureConfig.offset) || !Number.isFinite(featureConfig.period)) {
        console.error(`phased rollout of ${feature} is misconfigured, ` +
            `offset and/or period are not numbers, so disabling`, featureConfig);
        return false;
    }

    const hash = hashCode(username);
    //ms -> min, enable users at minute granularity
    const bucketRatio = 1000 * 60;
    const bucketCount = featureConfig.period / bucketRatio;
    const userBucket = hash % bucketCount;
    const userMs = userBucket * bucketRatio;
    const enableAt = featureConfig.offset + userMs;
    const result = now >= enableAt;
    const bucketStr = `(bucket ${userBucket}/${bucketCount})`;
    if (result) {
        console.log(`${feature} enabled for ${username} ${bucketStr}`);
    } else {
        console.log(`${feature} will be enabled for ${username} in ${Math.ceil((enableAt - now)/1000)}s ${bucketStr}`);
    }
    return result;
}
