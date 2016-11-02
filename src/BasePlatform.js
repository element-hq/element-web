// @flow

/*
Copyright 2016 Aviral Dasgupta and OpenMarket Ltd

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

/**
 * Base class for classes that provide platform-specific functionality
 * eg. Setting an application badge or displaying notifications
 *
 * Instances of this class are provided by the application.
 */
export default class BasePlatform {
    constructor() {
        this.notificationCount = 0;
        this.errorDidOccur = false;
    }

    setNotificationCount(count: number) {
        this.notificationCount = count;
    }

    setErrorStatus(errorDidOccur: boolean) {
        this.errorDidOccur = errorDidOccur;
    }

    displayNotification(title: string, msg: string, avatarUrl: string) {
    }

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
}
