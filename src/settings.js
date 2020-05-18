const sketch = require("sketch")
const Settings = sketch.Settings
const UI = sketch.UI
const responseOptions = {
    SAVE: 1000,
    CANCEL: 1002,
}
const prefernceKey = {
    IS_CHECK: "isCheckOnOpenDocument",
    CHECK_SCOPE: "copyCheckScope",
}
const panelSpec = {
    width: 300,
    height: 130,
    lineHeight: 25,
}
const checkScopeOptions = ["Selected page", 'Pages starting with "@"', "Entire document"]
let UIComponentRect = (y) => NSMakeRect(0, panelSpec.height - y, panelSpec.width, panelSpec.lineHeight)
let checkCopyToggle, checkScopeDropdown

const createLabel = (positionY, text) => {
    const label = NSTextField.alloc().initWithFrame(UIComponentRect(positionY))

    label.setStringValue(text)
    label.setSelectable(false)
    label.setEditable(false)
    label.setBezeled(false)
    label.setDrawsBackground(false)

    return label
}

const createToggle = (positionY, settingKey, text) => {
    const toggle = NSButton.alloc().initWithFrame(UIComponentRect(positionY))
    const initValue = Settings.settingForKey(settingKey) == 0 ? NSOffState : NSOnState

    toggle.setButtonType(NSSwitchButton)
    toggle.setBezelStyle(0)
    toggle.setTitle(text)
    toggle.setState(initValue)

    return toggle
}

const createDropdown = (positionY, possibleValue, initValue) => {
    const dropdowm = NSPopUpButton.alloc().initWithFrame(UIComponentRect(positionY))
    const initialIndex = possibleValue.indexOf(initValue)

    dropdowm.addItemsWithTitles(possibleValue)
    dropdowm.selectItemAtIndex(initialIndex !== -1 ? initialIndex : 0)

    return dropdowm
}

export const createSettingPanel = () => {
    var panel = COSAlertWindow.new()
    panel.setIcon(__command.pluginBundle().alertIcon())
    panel.setMessageText("Copy Updater Settings")
    panel.addButtonWithTitle("Save")
    panel.addButtonWithTitle("Cancel")
    const view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, panelSpec.width, panelSpec.height))
    panel.addAccessoryView(view)

    let checkScopeLabel = createLabel(30, "Copy check scope:")
    checkScopeDropdown = createDropdown(
        50,
        checkScopeOptions,
        checkScopeOptions[Settings.settingForKey(prefernceKey.CHECK_SCOPE)]
    )

    let toggleLabel = createLabel(100, "Other settings:")
    checkCopyToggle = createToggle(120, prefernceKey.IS_CHECK, "Check copy when open a document")

    view.addSubview(checkScopeLabel)
    view.addSubview(checkScopeDropdown)

    view.addSubview(toggleLabel)
    view.addSubview(checkCopyToggle)

    return panel.runModal()
}

export const updateSettings = () => {
    const checkScope = checkScopeDropdown.indexOfSelectedItem()
    Settings.setSettingForKey(prefernceKey.CHECK_SCOPE, checkScope)
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
