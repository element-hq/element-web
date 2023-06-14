/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { IServerVersions } from "./client";

export enum ServerSupport {
    Stable,
    Unstable,
    Unsupported,
}

export enum Feature {
    Thread = "Thread",
    ThreadUnreadNotifications = "ThreadUnreadNotifications",
    /**
     * @deprecated this is now exposed as a capability not a feature
     */
    LoginTokenRequest = "LoginTokenRequest",
    RelationBasedRedactions = "RelationBasedRedactions",
    AccountDataDeletion = "AccountDataDeletion",
    RelationsRecursion = "RelationsRecursion",
    IntentionalMentions = "IntentionalMentions",
}

type FeatureSupportCondition = {
    unstablePrefixes?: string[];
    matrixVersion?: string;
};

const featureSupportResolver: Record<string, FeatureSupportCondition> = {
    [Feature.Thread]: {
        unstablePrefixes: ["org.matrix.msc3440"],
        matrixVersion: "v1.3",
    },
    [Feature.ThreadUnreadNotifications]: {
        unstablePrefixes: ["org.matrix.msc3771", "org.matrix.msc3773"],
        matrixVersion: "v1.4",
    },
    [Feature.LoginTokenRequest]: {
        unstablePrefixes: ["org.matrix.msc3882"],
    },
    [Feature.RelationBasedRedactions]: {
        unstablePrefixes: ["org.matrix.msc3912"],
    },
    [Feature.AccountDataDeletion]: {
        unstablePrefixes: ["org.matrix.msc3391"],
    },
    [Feature.RelationsRecursion]: {
        unstablePrefixes: ["org.matrix.msc3981"],
    },
    [Feature.IntentionalMentions]: {
        unstablePrefixes: ["org.matrix.msc3952_intentional_mentions"],
    },
};

export async function buildFeatureSupportMap(versions: IServerVersions): Promise<Map<Feature, ServerSupport>> {
    const supportMap = new Map<Feature, ServerSupport>();
    for (const [feature, supportCondition] of Object.entries(featureSupportResolver)) {
        const supportMatrixVersion = versions.versions?.includes(supportCondition.matrixVersion || "") ?? false;
        const supportUnstablePrefixes =
            supportCondition.unstablePrefixes?.every((unstablePrefix) => {
                return versions.unstable_features?.[unstablePrefix] === true;
            }) ?? false;
        if (supportMatrixVersion) {
            supportMap.set(feature as Feature, ServerSupport.Stable);
        } else if (supportUnstablePrefixes) {
            supportMap.set(feature as Feature, ServerSupport.Unstable);
        } else {
            supportMap.set(feature as Feature, ServerSupport.Unsupported);
        }
    }
    return supportMap;
}
