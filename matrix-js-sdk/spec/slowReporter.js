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

/* eslint-disable no-console */

class JestSlowTestReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
        this._slowTests = [];
        this._slowTestSuites = [];
    }

    onRunComplete() {
        const displayResult = (result, isTestSuite) => {
            if (!isTestSuite) console.log();

            result.sort((a, b) => b.duration - a.duration);
            const rootPathRegex = new RegExp(`^${process.cwd()}`);
            const slowestTests = result.slice(0, this._options.numTests || 10);
            const slowTestTime = this._slowTestTime(slowestTests);
            const allTestTime = this._allTestTime(result);
            const percentTime = (slowTestTime / allTestTime) * 100;

            if (isTestSuite) {
                console.log(
                    `Top ${slowestTests.length} slowest test suites (${slowTestTime / 1000} seconds,` +
                        ` ${percentTime.toFixed(1)}% of total time):`,
                );
            } else {
                console.log(
                    `Top ${slowestTests.length} slowest tests (${slowTestTime / 1000} seconds,` +
                        ` ${percentTime.toFixed(1)}% of total time):`,
                );
            }

            for (let i = 0; i < slowestTests.length; i++) {
                const duration = slowestTests[i].duration;
                const filePath = slowestTests[i].filePath.replace(rootPathRegex, ".");

                if (isTestSuite) {
                    console.log(`  ${duration / 1000} seconds ${filePath}`);
                } else {
                    const fullName = slowestTests[i].fullName;
                    console.log(`  ${fullName}`);
                    console.log(`    ${duration / 1000} seconds ${filePath}`);
                }
            }
            console.log();
        };

        displayResult(this._slowTests);
        displayResult(this._slowTestSuites, true);
    }

    onTestResult(test, testResult) {
        this._slowTestSuites.push({
            duration: testResult.perfStats.runtime,
            filePath: testResult.testFilePath,
        });
        for (let i = 0; i < testResult.testResults.length; i++) {
            this._slowTests.push({
                duration: testResult.testResults[i].duration,
                fullName: testResult.testResults[i].fullName,
                filePath: testResult.testFilePath,
            });
        }
    }

    _slowTestTime(slowestTests) {
        let slowTestTime = 0;
        for (let i = 0; i < slowestTests.length; i++) {
            slowTestTime += slowestTests[i].duration;
        }
        return slowTestTime;
    }

    _allTestTime(result) {
        let allTestTime = 0;
        for (let i = 0; i < result.length; i++) {
            allTestTime += result[i].duration;
        }
        return allTestTime;
    }
}

module.exports = JestSlowTestReporter;
