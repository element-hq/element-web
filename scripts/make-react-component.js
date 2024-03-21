#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");

/**
 * Unsophisticated script to create a styled, unit-tested react component.
 * -filePath / -f : path to the component to be created, including new component name, excluding extension, relative to src
 * -withStyle / -s : optional, flag to create a style file for the component. Defaults to false.
 *
 * eg:
 * ```
 * node srcipts/make-react-component.js -f components/toasts/NewToast -s
 * ```
 * creates files:
 * - src/components/toasts/NewToast.tsx
 * - test/components/toasts/NewToast-test.tsx
 * - res/css/components/toasts/_NewToast.pcss
 *
 */

const TEMPLATES = {
    COMPONENT: `
import React from 'react';

interface Props {}

const %%ComponentName%%: React.FC<Props> = () => {
    return <div className='mx_%%ComponentName%%' />;
};

export default %%ComponentName%%;
`,
    TEST: `
import React from "react";
import { render } from "@testing-library/react";

import %%ComponentName%% from '%%RelativeComponentPath%%';

describe("<%%ComponentName%% />", () => {
    const defaultProps = {};
    const getComponent = (props = {}) =>
        render(<%%ComponentName%% {...defaultProps} {...props} />);

    it("matches snapshot", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot()();
    });
});
`,
    STYLE: `
.mx_%%ComponentName%% {

}
`,
};

const options = {
    alias: {
        filePath: "f",
        withStyle: "s",
    },
};

const args = require("minimist")(process.argv, options);

const ensureDirectoryExists = async (filePath) => {
    const dirName = path.parse(filePath).dir;

    try {
        await fs.access(dirName);
        return;
    } catch (error) {}

    await fs.mkdir(dirName, { recursive: true });
};

const makeFile = async ({ filePath, componentName, extension, base, template, prefix, componentFilePath }) => {
    const newFilePath = path.join(
        base,
        path.dirname(filePath),
        `${prefix || ""}${path.basename(filePath)}${extension}`,
    );
    await ensureDirectoryExists(newFilePath);

    const relativePathToComponent = path.parse(path.relative(path.dirname(newFilePath), componentFilePath || ""));
    const importComponentPath = path.join(relativePathToComponent.dir, relativePathToComponent.name);

    try {
        await fs.writeFile(newFilePath, fillTemplate(template, componentName, importComponentPath), { flag: "wx" });
        console.log(`Created ${path.relative(process.cwd(), newFilePath)}`);
        return newFilePath;
    } catch (error) {
        if (error.code === "EEXIST") {
            console.log(`File already exists ${path.relative(process.cwd(), newFilePath)}`);
            return newFilePath;
        } else {
            throw error;
        }
    }
};

const fillTemplate = (template, componentName, relativeComponentFilePath, skinnedSdkPath) =>
    template
        .replace(/%%ComponentName%%/g, componentName)
        .replace(/%%RelativeComponentPath%%/g, relativeComponentFilePath);

const makeReactComponent = async () => {
    const { filePath, withStyle } = args;

    if (!filePath) {
        throw new Error("No file path provided, did you forget -f?");
    }

    const componentName = filePath.split("/").slice(-1).pop();

    const componentFilePath = await makeFile({
        filePath,
        componentName,
        base: "src",
        extension: ".tsx",
        template: TEMPLATES.COMPONENT,
    });
    await makeFile({
        filePath,
        componentFilePath,
        componentName,
        base: "test",
        extension: "-test.tsx",
        template: TEMPLATES.TEST,
        componentName,
    });
    if (withStyle) {
        await makeFile({
            filePath,
            componentName,
            base: "res/css",
            prefix: "_",
            extension: ".pcss",
            template: TEMPLATES.STYLE,
        });
    }
};

// Wrapper since await at the top level is not well supported yet
function run() {
    (async function () {
        await makeReactComponent();
    })();
}

run();
return;
