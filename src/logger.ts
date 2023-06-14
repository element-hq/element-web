/*
Copyright 2018 André Jaenisch
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

import log, { Logger } from "loglevel";

// This is to demonstrate, that you can use any namespace you want.
// Namespaces allow you to turn on/off the logging for specific parts of the
// application.
// An idea would be to control this via an environment variable (on Node.js).
// See https://www.npmjs.com/package/debug to see how this could be implemented
// Part of #332 is introducing a logging library in the first place.
const DEFAULT_NAMESPACE = "matrix";

// because rageshakes in react-sdk hijack the console log, also at module load time,
// initializing the logger here races with the initialization of rageshakes.
// to avoid the issue, we override the methodFactory of loglevel that binds to the
// console methods at initialization time by a factory that looks up the console methods
// when logging so we always get the current value of console methods.
log.methodFactory = function (methodName, logLevel, loggerName) {
    return function (this: PrefixedLogger, ...args): void {
        /* eslint-disable @typescript-eslint/no-invalid-this */
        if (this.prefix) {
            args.unshift(this.prefix);
        }
        /* eslint-enable @typescript-eslint/no-invalid-this */
        const supportedByConsole =
            methodName === "error" || methodName === "warn" || methodName === "trace" || methodName === "info";
        /* eslint-disable no-console */
        if (supportedByConsole) {
            return console[methodName](...args);
        } else {
            return console.log(...args);
        }
        /* eslint-enable no-console */
    };
};

/**
 * Drop-in replacement for `console` using {@link https://www.npmjs.com/package/loglevel|loglevel}.
 * Can be tailored down to specific use cases if needed.
 */
export const logger = log.getLogger(DEFAULT_NAMESPACE) as PrefixedLogger;
logger.setLevel(log.levels.DEBUG, false);

export interface PrefixedLogger extends Logger {
    withPrefix: (prefix: string) => PrefixedLogger;
    prefix: string;
}

function extendLogger(logger: Logger): void {
    (<PrefixedLogger>logger).withPrefix = function (prefix: string): PrefixedLogger {
        const existingPrefix = this.prefix || "";
        return getPrefixedLogger(existingPrefix + prefix);
    };
}

extendLogger(logger);

function getPrefixedLogger(prefix: string): PrefixedLogger {
    const prefixLogger = log.getLogger(`${DEFAULT_NAMESPACE}-${prefix}`) as PrefixedLogger;
    if (prefixLogger.prefix !== prefix) {
        // Only do this setup work the first time through, as loggers are saved by name.
        extendLogger(prefixLogger);
        prefixLogger.prefix = prefix;
        prefixLogger.setLevel(log.levels.DEBUG, false);
    }
    return prefixLogger;
}
