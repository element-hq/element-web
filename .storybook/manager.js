import React from "react";

import { addons } from "storybook/manager-api";
import ElementTheme from "./ElementTheme";
import { languageAddon } from "./languageAddon";

addons.setConfig({
    theme: ElementTheme,
});

addons.register("elementhq/language", () => addons.add("language", languageAddon));
