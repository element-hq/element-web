/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

export type AvatarThumbnailData = {
    src: string;
    width: number;
    height: number;
    resizeMethod: "crop" | "scale";
};

export function avatarUrl(data: AvatarThumbnailData): string {
    const url = new URL(data.src);
    url.searchParams.set("method", data.resizeMethod);
    url.searchParams.set("width", Math.round(data.width).toString());
    url.searchParams.set("height", Math.round(data.height).toString());
    return url.toString();
}
