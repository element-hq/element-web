import { getFigmaComponents, getFigmaFile, getFigmaMe } from "./figma-api.mjs";

function printSection(title) {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
}

try {
    const [me, file, components] = await Promise.all([getFigmaMe(), getFigmaFile(), getFigmaComponents(20)]);

    printSection("Figma authentication");
    console.log(`User: ${me.email ?? me.handle ?? me.id}`);

    printSection("Selected file");
    console.log(`Name: ${file.name}`);
    console.log(`Key: ${file.key}`);
    console.log(`Version: ${file.version}`);
    console.log(`Last modified: ${file.lastModified}`);

    printSection("Available frames and sections");
    for (const frame of file.frames.slice(0, 25)) {
        console.log(`${frame.type.padEnd(14)} ${frame.id.padEnd(14)} ${frame.path}`);
    }

    printSection("Available components");
    for (const component of components.components) {
        console.log(`${component.nodeId.padEnd(14)} ${component.name}`);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}