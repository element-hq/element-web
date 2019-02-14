/*
Copyright 2019 New Vector Ltd

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

export function getHomePageUrl(appConfig) {
    const pagesConfig = appConfig.embeddedPages;
    let pageUrl = null;
    if (pagesConfig) {
        pageUrl = pagesConfig.homeUrl;
    }
    if (!pageUrl) {
        // This is a deprecated config option for the home page
        // (despite the name, given we also now have a welcome
        // page, which is not the same).
        pageUrl = appConfig.welcomePageUrl;
    }

    return pageUrl;
}
