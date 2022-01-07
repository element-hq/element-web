/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

export class Logger {
    private indent = 0;
    private muted = false;

    constructor(readonly username: string) {}

    public startGroup(description: string): Logger {
        if (!this.muted) {
            const indent = " ".repeat(this.indent * 2);
            console.log(`${indent} * ${this.username} ${description}:`);
        }
        this.indent += 1;
        return this;
    }

    public endGroup(): Logger {
        this.indent -= 1;
        return this;
    }

    public step(description: string): Logger {
        if (!this.muted) {
            const indent = " ".repeat(this.indent * 2);
            process.stdout.write(`${indent} * ${this.username} ${description} ... `);
        }
        return this;
    }

    public done(status = "done"): Logger {
        if (!this.muted) {
            process.stdout.write(status + "\n");
        }
        return this;
    }

    public mute(): Logger {
        this.muted = true;
        return this;
    }

    public unmute(): Logger {
        this.muted = false;
        return this;
    }
}
