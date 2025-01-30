/* eslint-disable n/no-process-exit */
const fs = require("fs");
const path = require("path");
// eslint-disable-next-line n/no-extraneous-require
const yaml = require("yaml");

// Directory where the YAML files are located
const directoryPath = "./translations";

// Function to insert the value into the YAML object
const insertValue = (translationsYamlMap, pathArray, value) => {
  const key = pathArray.shift();
  if (!key) return;

  // Ensure the key exists, creating a YAMLMap or setting the value directly if it's the last level
  if (!translationsYamlMap.has(key)) {
    translationsYamlMap.set(
      key,
      pathArray.length === 0 ? value : new yaml.YAMLMap()
    );
  }

  if (pathArray.length === 0) {
    // Check if the key can be updated
    const existingNode = translationsYamlMap.get(key);
    if (existingNode instanceof yaml.YAMLMap && existingNode.items.length > 0) {
      throw new Error("The key you want to update has children");
    }
    translationsYamlMap.set(key, value);
  } else {
    // Ensure the next level is a YAMLMap and recursively insert the value
    const childNode = translationsYamlMap.get(key);
    if (!(childNode instanceof yaml.YAMLMap)) {
      translationsYamlMap.set(key, new yaml.YAMLMap());
    }
    insertValue(translationsYamlMap.get(key), pathArray, value);
  }

  // Ensure the current level is sorted after any updates
  sortYamlKeys(translationsYamlMap);
};

// Function to sort YAML keys alphabetically, respecting hierarchy
const sortYamlKeys = (node) => {
  if (!node || typeof node !== "object" || !(node instanceof yaml.YAMLMap))
    return;

  // Sort the current level's keys alphabetically
  node.items.sort((a, b) => {
    const keyA = a.key.value || a.key || ""; // Ensure no undefined values
    const keyB = b.key.value || b.key || ""; // Ensure no undefined values
    return keyA.localeCompare(keyB);
  });

  // Recursively sort child keys for each item
  node.items.forEach((item) => {
    if (item.value && item.value instanceof yaml.YAMLMap) {
      sortYamlKeys(item.value); // Sort nested maps
    }
  });
};

// Prompt the user for input (path and value)
const promptUser = async () => {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const translationPath = await ask(
      "Enter the path (e.g., notifications.new-results.newfield): "
    );
    const translationValue = await ask("Enter the value: ");
    rl.close();
    return { translationPath, translationValue };
  } catch (error) {
    console.error("Error getting user input:", error);
    rl.close();
    process.exit(1);
  }
};

// Process YAML files in the directory
const processYamlFiles = async () => {
  const { translationPath, translationValue } = await promptUser();
  //Split route that wants to be introduced/modified
  const translationPathArray = translationPath.split(".");

  fs.readdir(directoryPath, (err, translationFile) => {
    if (err) {
      console.error("Error reading the directory:", err);
      return;
    }

    translationFile.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      if (path.extname(file) === ".yaml") {
        // Read YAML file as a document
        const fileContent = fs.readFileSync(filePath, "utf8");
        const doc = yaml.parseDocument(fileContent);

        // Modify the YAML document
        if (!doc.contents) {
          doc.contents = new yaml.YAMLMap(); // Ensure the document has a root
        }

        insertValue(doc.contents, [...translationPathArray], translationValue);

        // Sort keys alphabetically at all levels
        sortYamlKeys(doc.contents);

        // Save changes to the file, avoiding line breaks and preserving quotes
        const updatedYaml = doc
          .toString({
            lineWidth: 500, // Prevent line breaks
            defaultStringType: "QUOTE_SINGLE",
            defaultKeyType: "PLAIN",
          })
          .trimEnd();
        fs.writeFileSync(filePath, updatedYaml, "utf8");
        console.log(`File updated and saved: ${filePath}`);
      }
    });
  });
};

module.exports = processYamlFiles;
