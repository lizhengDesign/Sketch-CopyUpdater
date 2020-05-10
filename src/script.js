import dialog from "@skpm/dialog";
const fs = require("@skpm/fs");
const sketch = require("sketch");
const documentID = sketch.getSelectedDocument().id;
const resourcePath =
  context.scriptPath
    .stringByDeletingLastPathComponent()
    .stringByDeletingLastPathComponent() + "/Resources/";
const copyConfigFilePath = resourcePath + "copyConfig.json";
const copyKeyValuePairPath = resourcePath + documentID + ".json";
const doc = sketch.getSelectedDocument();
const selectedLayers = doc.selectedLayers;
const layerType = {
  ARTBOARD: "Artboard",
  SHAPEPATH: "ShapePath",
  TEXT: "Text",
  SYMBOLINSTANCE: "SymbolInstance",
};
const updateType = {
  KEY: false,
  VALUE: true,
};
const readJSONAsObject = (path) => {
  try {
    const data = JSON.parse(fs.readFileSync(path));
    return data;
  } catch (error) {
    return {};
  }
};
let storedCopyConfig = readJSONAsObject(copyConfigFilePath);
let storedCopyKeyValuePair = readJSONAsObject(copyKeyValuePairPath);

const readDatafromConfig = () => {
  const copyJSONPath = storedCopyConfig[documentID];
  if (!copyJSONPath) {
    sketch.UI.message("❌ Please setup a JSON file first");
  } else {
    const copyData = readJSONAsObject(copyJSONPath);
    if (Object.keys(copyData).length === 0) {
      sketch.UI.message(
        "❌ The JSON file was removed or contains error. Please select another one or fix it."
      );
    } else return copyData;
  }
  return undefined;
};

const updateCopyConfig = (JSONPath) => {
  storedCopyConfig[documentID] = JSONPath;
  fs.writeFileSync(copyConfigFilePath, JSON.stringify(storedCopyConfig));
  fs.writeFileSync(
    copyKeyValuePairPath,
    JSON.stringify(storedCopyKeyValuePair)
  );
};

const updateTextByType = (type) => {
  if (selectedLayers.length === 0) {
    sketch.UI.message("❌ Please select at least 1 layer or artboard.");
  } else {
    const copyData = readDatafromConfig();
    if (copyData) {
      sketch.UI.message("Updating...");

      const resolveValue = (path) => {
        return path.split(".").reduce((prev, curr) => {
          return prev ? prev[curr] : null;
        }, copyData || self);
      };

      const getCopyFromData = (id, value) => {
        let copyKey;
        if (value[0] == "@") {
          copyKey = value.slice(1);
          storedCopyKeyValuePair[id] = copyKey;
        } else {
          copyKey = storedCopyKeyValuePair[id];
        }
        const copyValue = copyKey ? resolveValue(copyKey) : undefined;
        switch (type) {
          case updateType.KEY:
            return copyKey ? "@" + copyKey : value;
          case updateType.VALUE:
            return copyValue ? copyValue : value;
          default:
        }
      };

      const updateChildrenLayers = (layer) => {
        if (layer.layers == undefined) {
          switch (layer.type) {
            case layerType.TEXT:
              layer.text = getCopyFromData(layer.id, layer.text);
              break;
            case layerType.SYMBOLINSTANCE:
              layer.overrides.forEach((override) => {
                if (override.property == "stringValue" && override.editable) {
                  override.value = getCopyFromData(
                    layer.id + "/" + override.id,
                    override.value
                  );
                }
              });
              layer.resizeWithSmartLayout();
              break;
            default:
          }
          return;
        } else {
          layer.layers.forEach((sublayer) => {
            updateChildrenLayers(sublayer);
          });
        }
      };
      selectedLayers.forEach((layer) => {
        updateChildrenLayers(layer);
      });
      fs.writeFileSync(
        copyKeyValuePairPath,
        JSON.stringify(storedCopyKeyValuePair)
      );
    }
  }
};

export const resetCopy = () => {
  updateTextByType(updateType.KEY);
};

export const updateCopy = () => {
  updateTextByType(updateType.VALUE);
};

export const setupJSON = () => {
  const selectedFile = dialog.showOpenDialogSync({
    properties: ["openFile"],
    filters: [{ extensions: ["json"] }],
  });
  const sourceFilePath = selectedFile[0];
  if (sourceFilePath) {
    updateCopyConfig(sourceFilePath);
  }
};
