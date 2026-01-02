#!/usr/bin/env node
/**
 * This script is used to reset the project to a blank state.
 * It deletes or moves the /app, /components, /hooks, /scripts, and /constants directories to /app-example
 * based on user input and creates a new /app directory with an index.tsx and _layout.tsx file.
 *
 * You can remove the `reset-project` script from package.json and safely delete this file after running it.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const oldDirs = ["app", "components", "hooks", "constants", "scripts"];
const exampleDir = "app-example";
const newAppDir = "app";
const exampleDirPath = path.join(root, exampleDir);

const indexContent = `import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}
`;

const layoutContent = `import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function moveOrDeleteDirectories(userInput) {
  try {
    if (userInput === "y") {
      await fs.promises.mkdir(exampleDirPath, { recursive: true });
      console.log(`📁 /${exampleDir} directory created.`);
    }

    for (const dir of oldDirs) {
      const oldDirPath = path.join(root, dir);

      if (!fs.existsSync(oldDirPath)) {
        console.log(`➡️ /${dir} does not exist, skipping.`);
        continue;
      }

      if (userInput === "y") {
        const newDirPath = path.join(root, exampleDir, dir);

        // If destination exists, remove it to avoid rename errors
        if (fs.existsSync(newDirPath)) {
          await fs.promises.rm(newDirPath, { recursive: true, force: true });
        }

        await fs.promises.rename(oldDirPath, newDirPath);
        console.log(`➡️ /${dir} moved to /${exampleDir}/${dir}.`);
      } else {
        await fs.promises.rm(oldDirPath, { recursive: true, force: true });
        console.log(`❌ /${dir} deleted.`);
      }
    }

    // Create new /app directory
    const newAppDirPath = path.join(root, newAppDir);
    await fs.promises.mkdir(newAppDirPath, { recursive: true });
    console.log("\n📁 New /app directory created.");

    // Create index.tsx
    const indexPath = path.join(newAppDirPath, "index.tsx");
    await fs.promises.writeFile(indexPath, indexContent, "utf8");
    console.log("📄 app/index.tsx created.");

    // Create _layout.tsx
    const layoutPath = path.join(newAppDirPath, "_layout.tsx");
    await fs.promises.writeFile(layoutPath, layoutContent, "utf8");
    console.log("📄 app/_layout.tsx created.");

    console.log("\n✅ Project reset complete. Next steps:");
    console.log(
      `1. Run \`npx expo start\` to start a development server.\n2. Edit app/index.tsx to edit the main screen.${
        userInput === "y"
          ? `\n3. Delete the /${exampleDir} directory when you're done referencing it.`
          : ""
      }`
    );
  } catch (error) {
    console.error(`❌ Error during script execution: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

rl.question(
  "Do you want to move existing files to /app-example instead of deleting them? (Y/n): ",
  (answer) => {
    const userInput = (answer.trim().toLowerCase() || "y");
    if (userInput === "y" || userInput === "n") {
      moveOrDeleteDirectories(userInput).finally(() => rl.close());
    } else {
      console.log("❌ Invalid input. Please enter 'Y' or 'N'.");
      rl.close();
      process.exitCode = 1;
    }
  }
);
