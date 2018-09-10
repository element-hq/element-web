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

import Promise from 'bluebird';
import request from 'browser-request';

export async function getVectorConfig(relativeLocation) {
    if (relativeLocation === undefined) relativeLocation = '';
    if (relativeLocation !== '' && !relativeLocation.endsWith('/')) relativeLocation += '/';
    try {
        const configJson = await getConfig(`${relativeLocation}config.${document.domain}.json`);
        // 404s succeed with an empty json config, so check that there are keys
        if (Object.keys(configJson).length === 0) {
            throw new Error(); // throw to enter the catch
        }
        return configJson;
    } catch (e) {
        return await getConfig(relativeLocation + "config.json");
    }
}

function getConfig(configJsonFilename) {
    let deferred = Promise.defer();

    request(
        { method: "GET", url: configJsonFilename },
        (err, response, body) => {
            if (err || response.status < 200 || response.status >= 300) {
                // Lack of a config isn't an error, we should
                // just use the defaults.
                // Also treat a blank config as no config, assuming
                // the status code is 0, because we don't get 404s
                // from file: URIs so this is the only way we can
                // not fail if the file doesn't exist when loading
                // from a file:// URI.
                if (response) {
                    if (response.status == 404 || (response.status == 0 && body == '')) {
                        deferred.resolve({});
                    }
                }
                deferred.reject({err: err, response: response});
                return;
            }

            // We parse the JSON ourselves rather than use the JSON
            // parameter, since this throws a parse error on empty
            // which breaks if there's no config.json and we're
            // loading from the filesystem (see above).
            deferred.resolve(JSON.parse(body));
        }
    );

    return deferred.promise;
}
