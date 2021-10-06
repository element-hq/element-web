/*
Copyright 2021 New Vector Ltd

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
 * Fetch an image using the best available method based on browser compatibility
 * @param url the URL of the image to fetch
 * @returns a canvas drawable object
 */
export async function getDrawable(url: string): Promise<CanvasImageSource> {
    if ('createImageBitmap' in window) {
        const response = await fetch(url);
        const blob = await response.blob();
        return await createImageBitmap(blob);
    } else {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    }
}
