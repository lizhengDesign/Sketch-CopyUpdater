const sketch = require("sketch")
const Settings = sketch.Settings
const UI = sketch.UI
const responseOptions = {
    SAVE: 1000,
    CANCEL: 1002,
}
const prefernceKey = {
    IS_CHECK: "isCheckOnOpenDocument",
}
const panelSpec = {
    width: 300,
    height: 50,
    lineHeight: 25,
}
let UIComponentRect = (y) => NSMakeRect(0, panelSpec.height - y, panelSpec.width, panelSpec.lineHeight)
let checkCopyToggle

const createToggle = (positionY, settingKey, text) => {
    const toggle = NSButton.alloc().initWithFrame(UIComponentRect(positionY))
    const initValue = Settings.settingForKey(settingKey) == 0 ? NSOffState : NSOnState

    toggle.setButtonType(NSSwitchButton)
    toggle.setBezelStyle(0)
    toggle.setTitle(text)
    toggle.setState(initValue)

    return toggle
}

export const createSettingPanel = () => {
    var panel = COSAlertWindow.new()
    panel.setIcon(__command.pluginBundle().alertIcon())
    panel.setMessageText("Copy Updater Settings")
    panel.addButtonWithTitle("Save")
    panel.addButtonWithTitle("Cancel")
    const view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, panelSpec.width, panelSpec.height))
    panel.addAccessoryView(view)

    checkCopyToggle = createToggle(30, prefernceKey.IS_CHECK, "Check copy when open a document")

    view.addSubview(checkCopyToggle)

    return panel.runModal()
}

export const updateSettings = () => {
    Settings.setSettingForKey(prefernceKey.IS_CHECK, checkCopyToggle.state())

    UI.message(`✅ Successfully updated`)
}

export default () => {
    let response = createSettingPanel()
    switch (response) {
        case responseOptions.SAVE:
            updateSettings()
            break
        case responseOptions.CANCEL:
            break
    }
}
