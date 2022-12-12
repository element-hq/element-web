/*
Copyright 2022 Emmanuel Ezeka <eec.studies@gmail.com>

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

import { textToHtmlRainbow } from "../../src/utils/colour";

describe("textToHtmlRainbow", () => {
    it("correctly transform text to html without splitting the emoji in two", () => {
        expect(textToHtmlRainbow("🐻")).toBe('<font color="#ff00be">🐻</font>');
        expect(textToHtmlRainbow("🐕‍🦺")).toBe('<font color="#ff00be">🐕‍🦺</font>');
    });
});
