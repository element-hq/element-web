// @flow

/*
Copyright 2016 Aviral Dasgupta
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

import BasePlatform from 'matrix-react-sdk/lib/BasePlatform'

/**
 * Vector-specific extensions to the BasePlatform template
 */
export default class VectorBasePlatform extends BasePlatform {
    /**
     * Check for the availability of an update to the version of the
     * app that's currently running.
     * If an update is available, this function should dispatch the
     * 'new_version' action.
     */
    pollForUpdate() {
    }

    /**
     * Update the currently running app to the latest available
     * version and replace this instance of the app with the
     * new version.
     */
    installUpdate() {
    }

    /**
     * Get a sensible default display name for the
     * device Vector is running on
     */
    getDefaultDeviceDisplayName(): string {
        return "Unknown device";
    }
}
