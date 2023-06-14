/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { parse as parseSdp } from "sdp-transform";

export type Mid = string;
export type Ssrc = string;
export type MapType = "local" | "remote";

export class MediaSsrcHandler {
    private readonly ssrcToMid = { local: new Map<Mid, Ssrc[]>(), remote: new Map<Mid, Ssrc[]>() };

    public findMidBySsrc(ssrc: Ssrc, type: "local" | "remote"): Mid | undefined {
        let mid: Mid | undefined;
        this.ssrcToMid[type].forEach((ssrcs, m) => {
            if (ssrcs.find((s) => s == ssrc)) {
                mid = m;
                return;
            }
        });
        return mid;
    }

    public parse(description: string, type: MapType): void {
        const sdp = parseSdp(description);
        const ssrcToMid = new Map<Mid, Ssrc[]>();
        sdp.media.forEach((m) => {
            if ((!!m.mid && m.type === "video") || m.type === "audio") {
                const ssrcs: Ssrc[] = [];
                m.ssrcs?.forEach((ssrc) => {
                    if (ssrc.attribute === "cname") {
                        ssrcs.push(`${ssrc.id}`);
                    }
                });
                ssrcToMid.set(`${m.mid}`, ssrcs);
            }
        });
        this.ssrcToMid[type] = ssrcToMid;
    }

    public getSsrcToMidMap(type: MapType): Map<Mid, Ssrc[]> {
        return this.ssrcToMid[type];
    }
}
